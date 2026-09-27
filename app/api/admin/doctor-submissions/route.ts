import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const select = `id,user_id,kind,target_doctor_id,full_name,email,phone,office_location,university_id,faculty_id,courses,status,admin_note,reviewed_by,reviewed_at,created_at,
  profiles:user_id(email,full_name),
  universities:university_id(name_ar),
  faculties:faculty_id(name_ar),
  target_doctor:target_doctor_id(id,full_name,email,phone,office_location,courses,university_id,faculty_id,updated_at,universities:university_id(name_ar),faculties:faculty_id(name_ar))`;

function flatten(row: any) {
  return {
    ...row,
    email: row.profiles?.email ?? "",
    user_name: row.profiles?.full_name ?? "",
    university_name: row.universities?.name_ar ?? "",
    faculty_name: row.faculties?.name_ar ?? "",
    // بيانات الدكتور الحالية (قبل التعديل) — تُستخدم في لوحة الإدارة لعرض
    // الفرق بين القديم والمقترح عند مساهمات التعديل.
    current: row.kind === "edit" ? row.target_doctor ?? null : null,
  };
}

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const q = supabaseAdmin.from("doctor_submissions").select(select).order("created_at", { ascending: false });
  const { data, error } = status === "all" ? await q : await q.eq("status", status);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: (data ?? []).map(flatten) });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const { id, action, admin_note } = body;
  if (!id || !["approve", "reject"].includes(action)) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const { data: submission, error: getError } = await supabaseAdmin.from("doctor_submissions").select("*").eq("id", id).single();
  if (getError || !submission) return NextResponse.json({ error: "المشاركة غير موجودة" }, { status: 404 });
  if (submission.status !== "pending") return NextResponse.json({ error: "تمت مراجعة هذه المشاركة مسبقًا" }, { status: 409 });

  if (action === "approve") {
    const fields = {
      full_name: submission.full_name,
      email: submission.email,
      phone: submission.phone,
      office_location: submission.office_location,
      university_id: submission.university_id,
      faculty_id: submission.faculty_id,
      courses: submission.courses,
    };
    if (submission.kind === "edit") {
      if (!submission.target_doctor_id) return NextResponse.json({ error: "لا يوجد دكتور مستهدف للتعديل" }, { status: 400 });
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("doctors")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", submission.target_doctor_id)
        .select()
        .single();
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      await logActivity({ actor, action: "doctor_updated", target_type: "doctor", target_id: updated.id, title_ar: updated.full_name });
    } else {
      const { data: created, error: insertError } = await supabaseAdmin
        .from("doctors")
        .insert({ ...fields, created_by: submission.user_id })
        .select()
        .single();
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      await logActivity({ actor, action: "doctor_added", target_type: "doctor", target_id: created.id, title_ar: created.full_name });
    }
  } else {
    await logActivity({ actor, action: "doctor_submission_rejected", target_type: "doctor_submission", target_id: submission.id, title_ar: submission.full_name });
  }

  const { data, error } = await supabaseAdmin
    .from("doctor_submissions")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      admin_note: admin_note || null,
      reviewed_by: actor.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submission: data });
}
