import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";



export async function POST(req: NextRequest) {
  if (!(await requireRole(req, ["admin","owner"]))) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

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
      return NextResponse.json({ data });
    }

    if (kind === "faculty") {
      const { data, error } = await supabaseAdmin
        .from("faculties")
        .insert({ name_ar: body.name_ar, university_id: body.university_id })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data });
    }

    if (kind === "course") {
      const { data, error } = await supabaseAdmin
        .from("courses")
        .insert({ name_ar: body.name_ar, code: body.code || null, faculty_id: body.faculty_id })
        .select()
        .single();
      if (error) throw error;
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
  if (!(await requireRole(req, ["admin","owner"]))) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json(); const { kind, id, name_ar, code } = body;
  if (!kind || !id || !name_ar) return NextResponse.json({ error: "بيانات التعديل ناقصة" }, { status: 400 });
  const table = kind === "university" ? "universities" : kind === "faculty" ? "faculties" : kind === "course" ? "courses" : null;
  if (!table) return NextResponse.json({ error: "kind غير معروف" }, { status: 400 });
  const payload:any = { name_ar }; if (kind === "course") payload.code = code || null;
  const { data, error } = await supabaseAdmin.from(table).update(payload).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireRole(req, ["admin","owner"]))) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const { searchParams } = new URL(req.url); const id = searchParams.get("id"); const kind = searchParams.get("kind");
  const table = kind === "university" ? "universities" : kind === "faculty" ? "faculties" : kind === "course" ? "courses" : null;
  if (!id || !table) return NextResponse.json({ error: "بيانات الحذف ناقصة" }, { status: 400 });
  const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
