import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { trashDriveLink, trashCourseFolder } from "@/lib/googleDrive";



export async function POST(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const { kind } = body as { kind: "university" | "faculty" | "course" };

  try {
    if (kind === "university") {
      const { data, error } = await supabaseAdmin
        .from("universities")
        .insert({ name_ar: body.name_ar })
        .select()
        .single();
      if (error) throw error;
      await logActivity({ actor, action: "university_added", target_type: "university", target_id: data.id, title_ar: data.name_ar });
      return NextResponse.json({ data });
    }

    if (kind === "faculty") {
      const { data, error } = await supabaseAdmin
        .from("faculties")
        .insert({ name_ar: body.name_ar, university_id: body.university_id })
        .select()
        .single();
      if (error) throw error;
      await logActivity({ actor, action: "faculty_added", target_type: "faculty", target_id: data.id, title_ar: data.name_ar });
      return NextResponse.json({ data });
    }

    if (kind === "course") {
      // رقم/رمز المساق إجباري عند الإضافة حتى تعمل خاصية البحث برقم المساق.
      if (!String(body.code ?? "").trim()) return NextResponse.json({ error: "رمز المساق إجباري" }, { status: 400 });
      const { data, error } = await supabaseAdmin
        .from("courses")
        .insert({ name_ar: body.name_ar, code: String(body.code).trim(), faculty_id: body.faculty_id })
        .select()
        .single();
      if (error) throw error;
      await logActivity({ actor, action: "course_added", target_type: "course", target_id: data.id, title_ar: data.name_ar, course_id: data.id });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "kind غير معروف" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "فشلت العملية" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireRole(req, ["admin","owner"]))) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const [universities, faculties, courses] = await Promise.all([
    supabaseAdmin.from("universities").select("*").order("name_ar"),
    supabaseAdmin.from("faculties").select("*").order("name_ar"),
    supabaseAdmin.from("courses").select("*").order("name_ar"),
  ]);
  return NextResponse.json({
    universities: universities.data ?? [],
    faculties: faculties.data ?? [],
    courses: courses.data ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json(); const { kind, id, name_ar, code } = body;
  if (!kind || !id || !name_ar) return NextResponse.json({ error: "بيانات التعديل ناقصة" }, { status: 400 });
  const table = kind === "university" ? "universities" : kind === "faculty" ? "faculties" : kind === "course" ? "courses" : null;
  if (!table) return NextResponse.json({ error: "kind غير معروف" }, { status: 400 });
  if (kind === "course" && !String(code ?? "").trim()) return NextResponse.json({ error: "رمز المساق إجباري" }, { status: 400 });
  const payload:any = { name_ar }; if (kind === "course") payload.code = String(code).trim();
  const { data, error } = await supabaseAdmin.from(table).update(payload).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logActivity({ actor, action: `${kind}_updated`, target_type: kind, target_id: id, title_ar: data.name_ar, course_id: kind === "course" ? id : null });
  return NextResponse.json({ data });
}

// كل المساقات التي ستُحذف تبعًا لحذف جامعة/كلية/مساق (الحذف في قاعدة البيانات cascade).
async function courseIdsUnder(kind: string, id: string): Promise<string[]> {
  if (kind === "course") return [id];
  let facultyIds: string[] = [id];
  if (kind === "university") {
    const { data } = await supabaseAdmin.from("faculties").select("id").eq("university_id", id);
    facultyIds = (data ?? []).map((f: any) => f.id);
  }
  if (!facultyIds.length) return [];
  const { data } = await supabaseAdmin.from("courses").select("id").in("faculty_id", facultyIds);
  return (data ?? []).map((c: any) => c.id);
}

export async function DELETE(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { searchParams } = new URL(req.url); const id = searchParams.get("id"); const kind = searchParams.get("kind");
  const table = kind === "university" ? "universities" : kind === "faculty" ? "faculties" : kind === "course" ? "courses" : null;
  if (!id || !kind || !table) return NextResponse.json({ error: "بيانات الحذف ناقصة" }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from(table).select("name_ar").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "العنصر غير موجود" }, { status: 404 });

  // نجمع ملفات Drive قبل الحذف لأن سجلات المواد ستُحذف تلقائيًا معه.
  const courseIds = await courseIdsUnder(kind, id);
  const { data: mats } = courseIds.length
    ? await supabaseAdmin.from("materials").select("drive_link").in("course_id", courseIds)
    : { data: [] as any[] };

  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // بعد نجاح الحذف: ننقل ملفات ومجلدات المساقات إلى سلة Drive (قابلة للاسترجاع).
  for (const m of mats ?? []) await trashDriveLink(m.drive_link);
  for (const cid of courseIds) await trashCourseFolder(cid);

  await logActivity({ actor, action: `${kind}_deleted`, target_type: kind, target_id: id, title_ar: existing.name_ar });
  return NextResponse.json({ ok: true });
}
