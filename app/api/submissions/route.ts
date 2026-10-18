import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser, rejectIfProfileIncomplete } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { extractYoutubeId } from "@/lib/youtube";
import { validateLink, validateMaterialInput } from "@/lib/validation";
import { MAX_PENDING_SUBMISSIONS_PER_USER, MAX_UPLOAD_BYTES } from "@/lib/uploadLimits";
import { isDriveFileUsedByMaterial } from "@/lib/driveCleanup";
import { badRequest, cleanText, isUuid, rateLimit, safeJson, serverError, tooManyRequests } from "@/lib/security";

const MIME_REGEX = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,60}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,100}$/i;

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select(
      "id,kind,title_ar,type,status,admin_note,created_at,reviewed_at,courses:course_id(name_ar),suggested_course_name,suggested_course_code,suggested_universities:suggested_university_id(name_ar)"
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

  const burst = rateLimit(`submit:${account.user.id}`, 20, 10 * 60 * 1000);
  if (!burst.ok) return tooManyRequests(burst.retryAfterSec);

  // التحقق من الحد الأقصى للمساهمات المعلقة لكل مستخدم لمنع الإغراق (Rate Limit)
  const { count: pendingCount } = await supabaseAdmin
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", account.user.id)
    .eq("status", "pending");

  if ((pendingCount ?? 0) >= MAX_PENDING_SUBMISSIONS_PER_USER) {
    return NextResponse.json(
      {
        error: `لديك ${pendingCount} مساهمات قيد المراجعة حاليًا. يرجى انتظار مراجعتها قبل إرسال المزيد.`,
      },
      { status: 429 }
    );
  }

  const body = await safeJson<Record<string, unknown>>(req);
  if (!body) return badRequest();
  const kind = body.kind === "course" ? "course" : "material";

  // اقتراح مساق جديد بالكامل (بدون محتوى) — يحتاج موافقة المسؤول قبل ظهوره.
  if (kind === "course") {
    const suggestedName = cleanText(body.suggested_course_name, 120);
    const suggestedCode = cleanText(body.suggested_course_code, 30);
    const suggestedUniId = String(body.suggested_university_id ?? "").trim();

    if (!suggestedName || !suggestedCode || !suggestedUniId) {
      return NextResponse.json({ error: "اسم المساق ورقمه والجامعة إجبارية" }, { status: 400 });
    }
    if (!isUuid(suggestedUniId)) return badRequest("الجامعة المختارة غير صالحة");

    const { data: uni } = await supabaseAdmin.from("universities").select("id").eq("id", suggestedUniId).maybeSingle();
    if (!uni) return badRequest("الجامعة المختارة غير موجودة");

    // لا نقبل اقتراح مساق موجود فعليًا في نفس الجامعة بنفس الرمز
    const { count: existingCourse } = await supabaseAdmin
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("university_id", suggestedUniId)
      .ilike("code", suggestedCode.replace(/[%_\\]/g, ""));
    if ((existingCourse ?? 0) > 0) {
      return NextResponse.json({ error: "هذا المساق (بنفس الرمز) موجود بالفعل في هذه الجامعة." }, { status: 409 });
    }

    const basePayload = {
      user_id: account.user.id,
      kind: "course",
      title_ar: suggestedName,
      suggested_course_name: suggestedName,
      suggested_course_code: suggestedCode,
      suggested_university_id: suggestedUniId,
    };

    let { data, error } = await supabaseAdmin
      .from("submissions")
      .insert({
        ...basePayload,
        submitter_name: account.profile.full_name,
        submitter_email: account.profile.email,
      })
      .select()
      .single();

    if (error) {
      // التوافق التراجعي إن لم تُنفذ أعمدة submitter_name بعد
      const retry = await supabaseAdmin.from("submissions").insert(basePayload).select().single();
      if (retry.error) return serverError(retry.error);
      data = retry.data;
    }

    await logActivity({
      actor: account,
      action: "submission_created",
      target_type: "submission",
      target_id: data.id,
      title_ar: `اقتراح مساق: ${data.suggested_course_name}`,
    });
    return NextResponse.json({ submission: data }, { status: 201 });
  }

  // مساهمة بمحتوى (مادة) لمساق موجود بالفعل — تبقى معلّقة حتى الموافقة.
  const { course_id, drive_link, youtube_input, file_size, mime_type, page_count } = body;
  if (!course_id) {
    return NextResponse.json({ error: "يرجى اختيار المساق" }, { status: 400 });
  }
  if (!isUuid(course_id)) return badRequest("المساق المختار غير صالح");

  const { data: course } = await supabaseAdmin.from("courses").select("id").eq("id", course_id).maybeSingle();
  if (!course) return badRequest("المساق المختار غير موجود");

  const validated = validateMaterialInput(body);
  if (!validated.valid || !validated.type) {
    return NextResponse.json({ error: validated.error || "الحقول الأساسية ناقصة" }, { status: 400 });
  }

  const basePayload: Record<string, unknown> = {
    user_id: account.user.id,
    kind: "material",
    course_id,
    title_ar: cleanText(validated.title_ar, 150),
    description_ar: validated.description_ar ? cleanText(validated.description_ar, 1500) : null,
    type: validated.type,
    academic_year: validated.academic_year,
    semester: validated.semester,
    drive_link: null,
    youtube_id: null,
  };

  if (validated.type === "video") {
    const id = extractYoutubeId(String(youtube_input ?? ""));
    if (!id) return NextResponse.json({ error: "رابط YouTube غير صالح" }, { status: 400 });
    basePayload.youtube_id = id;
  } else {
    const linkCheck = validateLink(drive_link);
    if (!linkCheck.valid || !linkCheck.url) {
      return NextResponse.json({ error: linkCheck.error || "رابط الملف غير صالح" }, { status: 400 });
    }

    // منع اختطاف ملف مادة منشورة: رابط Drive العام ظاهر لأي زائر، وإرساله كمساهمة جديدة
    // كان يتيح (عند الرفض لاحقًا) حذف الملف الأصلي من Drive. نرفض روابط الملفات المنشورة أصلًا.
    if (linkCheck.isDrive && (await isDriveFileUsedByMaterial(linkCheck.url))) {
      return NextResponse.json(
        { error: "هذا الملف منشور بالفعل في المكتبة. ابحث عنه قبل إعادة إرساله." },
        { status: 409 }
      );
    }
    basePayload.drive_link = linkCheck.url;
  }

  // بيانات الملف يرسلها المتصفح، فلا نثق بها كما هي: نتحقق من النوع والمدى.
  const safeFileSize =
    typeof file_size === "number" && Number.isFinite(file_size) && file_size > 0 && file_size <= MAX_UPLOAD_BYTES
      ? Math.round(file_size)
      : null;
  const safeMime = typeof mime_type === "string" && MIME_REGEX.test(mime_type.trim()) ? mime_type.trim().toLowerCase() : null;
  const safePages =
    typeof page_count === "number" && Number.isInteger(page_count) && page_count > 0 && page_count <= 100_000
      ? page_count
      : null;

  const extendedPayload = {
    ...basePayload,
    submitter_name: account.profile.full_name,
    submitter_email: account.profile.email,
    file_size: safeFileSize,
    mime_type: safeMime,
    page_count: safePages,
  };

  let { data, error } = await supabaseAdmin.from("submissions").insert(extendedPayload).select().single();
  if (error) {
    const retry = await supabaseAdmin.from("submissions").insert(basePayload).select().single();
    if (retry.error) return serverError(retry.error);
    data = retry.data;
  }

  await logActivity({
    actor: account,
    action: "submission_created",
    target_type: "submission",
    target_id: data.id,
    title_ar: data.title_ar,
    course_id: data.course_id,
  });
  return NextResponse.json({ submission: data }, { status: 201 });
}
