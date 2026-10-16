import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser, rejectIfProfileIncomplete } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { MAX_PENDING_SUBMISSIONS_PER_USER } from "@/lib/uploadLimits";

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("doctor_submissions")
    .select(
      "id,kind,target_doctor_id,full_name,email,phone,office_location,courses,status,admin_note,created_at,reviewed_at,universities:university_id(name_ar)"
    )
    .eq("user_id", account.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const incomplete = rejectIfProfileIncomplete(account.profile);
  if (incomplete) return incomplete;

  // حد عدد المساهمات المعلقة لكل مستخدم (Rate Limit)
  const { count: pendingCount } = await supabaseAdmin
    .from("doctor_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", account.user.id)
    .eq("status", "pending");

  if ((pendingCount ?? 0) >= MAX_PENDING_SUBMISSIONS_PER_USER) {
    return NextResponse.json(
      { error: "لديك عدة طلبات قيد المراجعة حاليًا، يرجى انتظار مراجعتها أولًا." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const kind = body.kind === "edit" ? "edit" : "new";
  const { full_name, email, phone, office_location, university_id, target_doctor_id } = body;
  const courses: string[] = Array.isArray(body.courses)
    ? body.courses.map((c: string) => String(c).trim()).filter(Boolean)
    : [];

  const cleanName = String(full_name ?? "").trim();
  const cleanEmail = String(email ?? "").trim().toLowerCase();

  if (!cleanName || !cleanEmail || !university_id || courses.length === 0) {
    return NextResponse.json(
      { error: "الاسم الكامل والبريد الإلكتروني والجامعة والمساق (مساق واحد على الأقل) حقول إجبارية" },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return NextResponse.json({ error: "صيغة البريد الإلكتروني غير صحيحة" }, { status: 400 });
  }

  if (kind === "edit" && !target_doctor_id) {
    return NextResponse.json(
      { error: "لا يمكن إرسال تعديل بدون تحديد الدكتور المطلوب تعديله" },
      { status: 400 }
    );
  }

  // كشف التكرار عند إرسال دكتور جديد بدل الاعتماد على انتباه المسؤول فقط
  if (kind === "new") {
    const { data: existingDoc } = await supabaseAdmin
      .from("doctors")
      .select("id,full_name,email")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (existingDoc) {
      return NextResponse.json(
        {
          error: `الدكتور «${existingDoc.full_name}» مسجّل بالفعل بهذا البريد الإلكتروني (${existingDoc.email}). يرجى استخدام تبويب «تعديل دكتور موجود» لتحديث بياناته.`,
          existing_doctor_id: existingDoc.id,
        },
        { status: 409 }
      );
    }
  }

  const basePayload = {
    user_id: account.user.id,
    kind,
    target_doctor_id: kind === "edit" ? target_doctor_id : null,
    full_name: cleanName,
    email: cleanEmail,
    phone: phone?.trim() || null,
    office_location: office_location?.trim() || null,
    university_id,
    courses,
  };

  let { data, error } = await supabaseAdmin
    .from("doctor_submissions")
    .insert({
      ...basePayload,
      submitter_name: account.profile.full_name,
      submitter_email: account.profile.email,
    })
    .select()
    .single();

  if (error) {
    const retry = await supabaseAdmin.from("doctor_submissions").insert(basePayload).select().single();
    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
    data = retry.data;
  }

  await logActivity({
    actor: account,
    action: "doctor_submission_created",
    target_type: "doctor_submission",
    target_id: data.id,
    title_ar: data.full_name,
  });
  return NextResponse.json({ submission: data }, { status: 201 });
}
