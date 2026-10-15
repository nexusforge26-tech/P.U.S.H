import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { extractYoutubeId } from "@/lib/youtube";
import { validateLink, validateMaterialInput } from "@/lib/validation";
import { MAX_PENDING_SUBMISSIONS_PER_USER } from "@/lib/uploadLimits";

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("submissions")
    .select(
      "id,kind,title_ar,type,status,admin_note,created_at,reviewed_at,courses:course_id(name_ar),suggested_course_name,suggested_course_code,suggested_universities:suggested_university_id(name_ar)"
    )
    .eq("user_id", account.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

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

  const body = await req.json();
  const kind = body.kind === "course" ? "course" : "material";

  // اقتراح مساق جديد بالكامل (بدون محتوى) — يحتاج موافقة المسؤول قبل ظهوره.
  if (kind === "course") {
    const suggestedName = String(body.suggested_course_name ?? "").trim();
    const suggestedCode = String(body.suggested_course_code ?? "").trim();
    const suggestedUniId = String(body.suggested_university_id ?? "").trim();

    if (!suggestedName || !suggestedCode || !suggestedUniId) {
      return NextResponse.json({ error: "اسم المساق ورقمه والجامعة إجبارية" }, { status: 400 });
    }
    if (suggestedName.length > 120 || suggestedCode.length > 30) {
      return NextResponse.json({ error: "اسم المساق أو رمزه طويل جدًا" }, { status: 400 });
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
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
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

  const validated = validateMaterialInput(body);
  if (!validated.valid || !validated.type) {
    return NextResponse.json({ error: validated.error || "الحقول الأساسية ناقصة" }, { status: 400 });
  }

  const basePayload: Record<string, unknown> = {
    user_id: account.user.id,
    kind: "material",
    course_id,
    title_ar: validated.title_ar,
    description_ar: validated.description_ar,
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
    basePayload.drive_link = linkCheck.url;
  }

  const extendedPayload = {
    ...basePayload,
    submitter_name: account.profile.full_name,
    submitter_email: account.profile.email,
    file_size: typeof file_size === "number" && file_size > 0 ? file_size : null,
    mime_type: typeof mime_type === "string" && mime_type ? mime_type : null,
    page_count: typeof page_count === "number" && page_count > 0 ? page_count : null,
  };

  let { data, error } = await supabaseAdmin.from("submissions").insert(extendedPayload).select().single();
  if (error) {
    const retry = await supabaseAdmin.from("submissions").insert(basePayload).select().single();
    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
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
