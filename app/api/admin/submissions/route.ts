import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const select = `id,user_id,kind,course_id,title_ar,description_ar,type,academic_year,semester,drive_link,youtube_id,status,admin_note,reviewed_by,reviewed_at,created_at,
  suggested_course_name,suggested_course_code,suggested_faculty_id,
  profiles:user_id(email,full_name),
  courses:course_id(name_ar,code,faculties:faculty_id(name_ar,universities:university_id(name_ar)) ),
  suggested_faculties:suggested_faculty_id(name_ar,universities:university_id(name_ar))`;

function flatten(row: any) {
  return {
    ...row,
    email: row.profiles?.email ?? "",
    user_name: row.profiles?.full_name ?? "",
    course_name: row.kind === "course" ? row.suggested_course_name ?? "" : row.courses?.name_ar ?? "",
    course_code: row.kind === "course" ? row.suggested_course_code ?? "" : row.courses?.code ?? "",
    faculty_name: row.kind === "course" ? row.suggested_faculties?.name_ar ?? "" : row.courses?.faculties?.name_ar ?? "",
    university_name: row.kind === "course" ? row.suggested_faculties?.universities?.name_ar ?? "" : row.courses?.faculties?.universities?.name_ar ?? "",
  };
}

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const q = supabaseAdmin.from("submissions").select(select).order("created_at", { ascending: false });
  const { data, error } = status === "all" ? await q : await q.eq("status", status);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: (data ?? []).map(flatten) });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const { id, action, admin_note } = body;
  if (!id || !["approve","reject"].includes(action)) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const { data: submission, error: getError } = await supabaseAdmin.from("submissions").select("*").eq("id", id).single();
  if (getError || !submission) return NextResponse.json({ error: "المشاركة غير موجودة" }, { status: 404 });

  if (submission.status !== "pending") return NextResponse.json({ error: "تمت مراجعة هذه المشاركة مسبقًا" }, { status: 409 });

  if (action === "approve") {
    if (submission.kind === "course") {
      // اقتراح مساق جديد: عند القبول يُنشأ المساق فعليًا تحت الكلية المحددة.
      const { data: newCourse, error: courseError } = await supabaseAdmin.from("courses").insert({
        name_ar: submission.suggested_course_name,
        code: submission.suggested_course_code,
        faculty_id: submission.suggested_faculty_id,
      }).select().single();
      if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 });
      await logActivity({ actor, action: "course_suggestion_approved", target_type: "course", target_id: newCourse.id, title_ar: newCourse.name_ar, course_id: newCourse.id });
    } else {
      const payload = {
        course_id: submission.course_id,
        title_ar: submission.title_ar,
        description_ar: submission.description_ar,
        type: submission.type,
        academic_year: submission.academic_year,
        semester: submission.semester,
        drive_link: submission.drive_link,
        youtube_id: submission.youtube_id,
        is_featured: false,
        // نحتفظ بهوية صاحب المساهمة الأصلي حتى يستطيع تعديل/حذف ما نشره
        // بنفسه خلال 6 ساعات من صفحة حسابه.
        created_by: submission.user_id,
      };
      const { data: newMaterial, error: insertError } = await supabaseAdmin.from("materials").insert(payload).select().single();
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      await logActivity({ actor, action: "submission_approved", target_type: "material", target_id: newMaterial.id, title_ar: newMaterial.title_ar, course_id: newMaterial.course_id });
    }
  } else {
    await logActivity({ actor, action: "submission_rejected", target_type: "submission", target_id: submission.id, title_ar: submission.title_ar ?? submission.suggested_course_name, course_id: submission.course_id });
  }

  const { data, error } = await supabaseAdmin.from("submissions").update({
    status: action === "approve" ? "approved" : "rejected",
    admin_note: admin_note || null,
    reviewed_by: actor.user.id,
    reviewed_at: new Date().toISOString(),
  }).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submission: data });
}
