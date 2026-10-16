import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireStaff, forbiddenOutOfScope } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createUserNotification } from "@/lib/notifications";
import { matchesArabicSearch } from "@/lib/arabic";

const select = `id,user_id,submitter_name,submitter_email,kind,target_doctor_id,full_name,email,phone,office_location,university_id,courses,status,admin_note,reviewed_by,reviewed_at,created_at,
  profiles:user_id(email,full_name),
  universities:university_id(name_ar),
  target_doctor:target_doctor_id(id,full_name,email,phone,office_location,courses,university_id,updated_at,universities:university_id(name_ar))`;

const selectFallback = `id,user_id,kind,target_doctor_id,full_name,email,phone,office_location,university_id,courses,status,admin_note,reviewed_by,reviewed_at,created_at,
  profiles:user_id(email,full_name),
  universities:university_id(name_ar),
  target_doctor:target_doctor_id(id,full_name,email,phone,office_location,courses,university_id,updated_at,universities:university_id(name_ar))`;

function flatten(row: Record<string, unknown>) {
  const profile = row.profiles as { email?: string; full_name?: string } | null;
  const uni = row.universities as { name_ar?: string } | null;
  return {
    ...row,
    // نحتفظ ببريد الدكتور في row.email، ونضع بريد حساب المرسل في submitter_account_email
    email: row.email,
    submitter_account_email: profile?.email ?? (row.submitter_email as string) ?? "",
    user_name: profile?.full_name ?? (row.submitter_name as string) ?? profile?.email ?? "",
    university_name: uni?.name_ar ?? "",
    current: row.kind === "edit" ? row.target_doctor ?? null : null,
  };
}

export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") ?? "pending";

  const runSelect = async (sel: string) => {
    let q = supabaseAdmin
      .from("doctor_submissions")
      .select(sel)
      .order("created_at", { ascending: false });
    // مسؤول الجامعة: طلبات دكاترة جامعته فقط
    if (actor.scopeUniversityId) q = q.eq("university_id", actor.scopeUniversityId);
    return status === "all" ? await q : await q.eq("status", status);
  };

  let { data, error } = await runSelect(select);
  if (error) {
    const fallback = await runSelect(selectFallback);
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    data = fallback.data;
  }

  return NextResponse.json({
    submissions: (data ?? []).map((r) => flatten(r as unknown as Record<string, unknown>)),
  });
}

async function syncDoctorCoursesJoinTable(
  doctorId: string,
  universityId: string,
  courseNames: string[]
) {
  try {
    const { data: uniCourses } = await supabaseAdmin
      .from("courses")
      .select("id,name_ar,code")
      .eq("university_id", universityId);

    if (!uniCourses || uniCourses.length === 0) return;

    const matchedIds = uniCourses
      .filter((uc) =>
        courseNames.some(
          (cn) => matchesArabicSearch(uc.name_ar, cn) || (uc.code && matchesArabicSearch(uc.code, cn))
        )
      )
      .map((uc) => uc.id);

    await supabaseAdmin.from("doctor_courses").delete().eq("doctor_id", doctorId);
    if (matchedIds.length > 0) {
      await supabaseAdmin.from("doctor_courses").insert(
        matchedIds.map((course_id) => ({
          doctor_id: doctorId,
          course_id,
        }))
      );
    }
  } catch {
    // جدول doctor_courses اختياري للتوافق في حال لم يُنفذ الترحيل بعد
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const { id, action, admin_note } = body;
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // فحص النطاق قبل الحجز: الطلب نفسه + الدكتور المستهدف في حال التعديل يجب أن يتبعا جامعة مسؤول الجامعة
  if (actor.scopeUniversityId) {
    const { data: pre } = await supabaseAdmin
      .from("doctor_submissions")
      .select("id,university_id,kind,target_doctor_id")
      .eq("id", id)
      .maybeSingle();
    if (!pre) return NextResponse.json({ error: "المشاركة غير موجودة" }, { status: 404 });
    if (pre.university_id !== actor.scopeUniversityId) return forbiddenOutOfScope();
    if (pre.kind === "edit" && pre.target_doctor_id) {
      const { data: doc } = await supabaseAdmin
        .from("doctors")
        .select("university_id")
        .eq("id", pre.target_doctor_id)
        .maybeSingle();
      if (doc && doc.university_id !== actor.scopeUniversityId) return forbiddenOutOfScope();
    }
  }

  // حجز ذرّي (Atomic Lock): نحدّث الحالة بشرط status='pending' لمنع الازدواجية
  const { data: submission, error: claimError } = await supabaseAdmin
    .from("doctor_submissions")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      admin_note: admin_note?.trim() || null,
      reviewed_by: actor.user.id,
      reviewed_at: now,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!submission) {
    return NextResponse.json(
      { error: "تمت مراجعة هذه المشاركة مسبقًا أو تتم مراجعتها الآن" },
      { status: 409 }
    );
  }

  const rollbackClaim = async () => {
    await supabaseAdmin
      .from("doctor_submissions")
      .update({ status: "pending", reviewed_by: null, reviewed_at: null })
      .eq("id", id);
  };

  if (action === "approve") {
    const fields = {
      full_name: submission.full_name,
      email: String(submission.email).trim().toLowerCase(),
      phone: submission.phone,
      office_location: submission.office_location,
      university_id: submission.university_id,
      courses: submission.courses,
    };

    if (submission.kind === "edit") {
      if (!submission.target_doctor_id) {
        await rollbackClaim();
        return NextResponse.json({ error: "لا يوجد دكتور مستهدف للتعديل" }, { status: 400 });
      }
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("doctors")
        .update({ ...fields, updated_at: now })
        .eq("id", submission.target_doctor_id)
        .select()
        .single();

      if (updateError) {
        await rollbackClaim();
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await syncDoctorCoursesJoinTable(updated.id, updated.university_id, updated.courses ?? []);

      await logActivity({
        actor,
        action: "doctor_submission_approved",
        target_type: "doctor",
        target_id: updated.id,
        title_ar: `تعديل: ${updated.full_name}`,
        university_id: updated.university_id,
      });
      await logActivity({
        actor,
        action: "doctor_updated",
        target_type: "doctor",
        target_id: updated.id,
        title_ar: updated.full_name,
        university_id: updated.university_id,
      });
    } else {
      const { data: created, error: insertError } = await supabaseAdmin
        .from("doctors")
        .insert({ ...fields, created_by: submission.user_id })
        .select()
        .single();

      if (insertError) {
        await rollbackClaim();
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      await syncDoctorCoursesJoinTable(created.id, created.university_id, created.courses ?? []);

      await logActivity({
        actor,
        action: "doctor_submission_approved",
        target_type: "doctor",
        target_id: created.id,
        title_ar: created.full_name,
        university_id: created.university_id,
      });
      await logActivity({
        actor,
        action: "doctor_added",
        target_type: "doctor",
        target_id: created.id,
        title_ar: created.full_name,
        university_id: created.university_id,
      });
    }

    await createUserNotification({
      userId: submission.user_id,
      title: "تمت الموافقة على معلومات الدكتور ✓",
      message: `تم اعتماد ونشر معلومات «${submission.full_name}» في دليل الدكاترة.`,
      link: "/doctors",
    });
  } else {
    await logActivity({
      actor,
      action: "doctor_submission_rejected",
      target_type: "doctor_submission",
      target_id: submission.id,
      title_ar: submission.full_name,
      university_id: submission.university_id,
    });

    await createUserNotification({
      userId: submission.user_id,
      title: "تحديث بشأن مساهمتك في دليل الدكاترة",
      message: `تعذر قبول المساهمة الخاصة بـ «${submission.full_name}»${
        admin_note ? `. السبب: ${admin_note}` : "."
      }`,
      link: "/account",
    });
  }

  return NextResponse.json({ submission });
}
