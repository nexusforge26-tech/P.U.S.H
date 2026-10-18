import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser, rejectIfProfileIncomplete } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { MAX_PENDING_SUBMISSIONS_PER_USER } from "@/lib/uploadLimits";
import {
  badRequest,
  cleanText,
  isUuid,
  isValidEmail,
  rateLimit,
  safeJson,
  serverError,
  tooManyRequests,
} from "@/lib/security";

const MAX_COURSES_PER_DOCTOR = 30;

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("doctor_submissions")
    .select(
      "id,kind,target_doctor_id,full_name,email,office_location,courses,status,admin_note,created_at,reviewed_at,universities:university_id(name_ar)"
    )
    .eq("user_id", account.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return serverError(error);
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const incomplete = rejectIfProfileIncomplete(account.profile);
  if (incomplete) return incomplete;

  const burst = rateLimit(`doctor-submit:${account.user.id}`, 15, 10 * 60 * 1000);
  if (!burst.ok) return tooManyRequests(burst.retryAfterSec);

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

  const body = await safeJson<Record<string, unknown>>(req);
  if (!body) return badRequest();

  const kind = body.kind === "edit" ? "edit" : "new";
  const universityId = String(body.university_id ?? "").trim();
  const targetDoctorId = body.target_doctor_id ? String(body.target_doctor_id).trim() : "";

  // كل مدخل نصي يُقصّ ويُنظّف؛ كانت الحقول بلا حد طول (والمصفوفة بلا حد عدد) فيمكن تضخيم قاعدة البيانات.
  const courses: string[] = Array.isArray(body.courses)
    ? Array.from(
        new Set(
          (body.courses as unknown[])
            .map((c) => cleanText(c, 100))
            .filter(Boolean)
        )
      ).slice(0, MAX_COURSES_PER_DOCTOR)
    : [];

  const cleanName = cleanText(body.full_name, 150);
  const cleanEmail = cleanText(body.email, 150).toLowerCase();
  const cleanOffice = cleanText(body.office_location, 150);

  if (!cleanName || !cleanEmail || !universityId || courses.length === 0) {
    return NextResponse.json(
      { error: "الاسم الكامل والبريد الإلكتروني والجامعة والمساق (مساق واحد على الأقل) حقول إجبارية" },
      { status: 400 }
    );
  }

  if (!isValidEmail(cleanEmail)) {
    return NextResponse.json({ error: "صيغة البريد الإلكتروني غير صحيحة" }, { status: 400 });
  }

  if (!isUuid(universityId)) return badRequest("الجامعة المختارة غير صالحة");
  const { data: uni } = await supabaseAdmin.from("universities").select("id").eq("id", universityId).maybeSingle();
  if (!uni) return badRequest("الجامعة المختارة غير موجودة");

  if (kind === "edit") {
    if (!targetDoctorId) {
      return NextResponse.json(
        { error: "لا يمكن إرسال تعديل بدون تحديد الدكتور المطلوب تعديله" },
        { status: 400 }
      );
    }
    if (!isUuid(targetDoctorId)) return badRequest("الدكتور المطلوب تعديله غير صالح");
    const { data: doc } = await supabaseAdmin.from("doctors").select("id").eq("id", targetDoctorId).maybeSingle();
    if (!doc) return NextResponse.json({ error: "الدكتور المطلوب تعديله غير موجود" }, { status: 404 });
  }

  // كشف التكرار عند إرسال دكتور جديد بدل الاعتماد على انتباه المسؤول فقط
  if (kind === "new") {
    const { data: existingDoc } = await supabaseAdmin
      .from("doctors")
      .select("id,full_name,email")
      .eq("email", cleanEmail)
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
    target_doctor_id: kind === "edit" ? targetDoctorId : null,
    full_name: cleanName,
    email: cleanEmail,
    office_location: cleanOffice || null,
    university_id: universityId,
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
    if (retry.error) return serverError(retry.error);
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
