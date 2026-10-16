import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser, rejectIfProfileIncomplete } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { SELF_EDIT_WINDOW_HOURS } from "@/lib/types";
import { extractYoutubeId } from "@/lib/youtube";
import { validateLink, validateMaterialInput } from "@/lib/validation";
import { deleteDriveFileByLink } from "@/lib/googleDrive";

const WINDOW_MS = SELF_EDIT_WINDOW_HOURS * 60 * 60 * 1000;

const select = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, downloads_count, created_at, created_by,
  courses:course_id ( name_ar, code, universities:university_id ( name_ar ) )
`;

function flatten(row: Record<string, unknown>) {
  const course = row.courses as { name_ar?: string; code?: string; universities?: { name_ar?: string } } | null;
  const createdAt = String(row.created_at ?? "");
  return {
    ...row,
    course_name: course?.name_ar ?? null,
    course_code: course?.code ?? null,
    university_name: course?.universities?.name_ar ?? null,
    editable: Date.now() - new Date(createdAt).getTime() < WINDOW_MS,
  };
}

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("materials")
    .select(select)
    .eq("created_by", account.user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map((r) => flatten(r as Record<string, unknown>)) });
}

async function loadOwned(id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("materials")
    .select("id,title_ar,description_ar,type,academic_year,semester,drive_link,youtube_id,course_id,created_by,created_at")
    .eq("id", id)
    .maybeSingle();

  if (!data || data.created_by !== userId) {
    return { error: NextResponse.json({ error: "هذه المادة ليست ضمن منشوراتك" }, { status: 403 }) };
  }
  if (Date.now() - new Date(data.created_at).getTime() >= WINDOW_MS) {
    return {
      error: NextResponse.json(
        {
          error: `انتهت مهلة ${SELF_EDIT_WINDOW_HOURS} ساعات المسموحة للتعديل. تواصل مع الإدارة لتعديل هذه المادة.`,
        },
        { status: 403 }
      ),
    };
  }
  return { data };
}

export async function PATCH(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const incomplete = rejectIfProfileIncomplete(account.profile);
  if (incomplete) return incomplete;

  const body = await req.json();
  const { id, drive_link, youtube_input } = body;
  if (!id) return NextResponse.json({ error: "معرّف المادة مطلوب" }, { status: 400 });

  const owned = await loadOwned(id, account.user.id);
  if (owned.error) return owned.error;
  const existing = owned.data!;

  const validated = validateMaterialInput({ ...body, requireType: false });
  if (!validated.valid) {
    return NextResponse.json({ error: validated.error || "بيانات التعديل غير صالحة" }, { status: 400 });
  }

  // تحديث البيانات الوصفية الآمنة فقط (العنوان، الوصف، الفصل، العام الدراسي) مباشرة على المادة المنشورة.
  const metadataPayload: Record<string, unknown> = {
    title_ar: validated.title_ar,
    description_ar: validated.description_ar,
    academic_year: validated.academic_year,
    semester: validated.semester,
  };

  // التحقق مما إذا حاول صاحب المادة تغيير الرابط أو الفيديو بعد النشر:
  // لمنع ثغرة استبدال الملف المراجع بمحتوى غير مراجع، يتم تحويل أي تغيير في الرابط إلى "تعديل معلّق" يمر بمراجعة الإدارة!
  let sourceChanged = false;
  let newDriveLink: string | null = existing.drive_link;
  let newYoutubeId: string | null = existing.youtube_id;

  if (existing.type === "video" && youtube_input !== undefined) {
    const extracted = extractYoutubeId(String(youtube_input ?? ""));
    if (!extracted) return NextResponse.json({ error: "رابط YouTube غير صالح" }, { status: 400 });
    if (extracted !== existing.youtube_id) {
      sourceChanged = true;
      newYoutubeId = extracted;
    }
  } else if (existing.type !== "video" && drive_link !== undefined) {
    const linkCheck = validateLink(drive_link);
    if (!linkCheck.valid || !linkCheck.url) {
      return NextResponse.json({ error: linkCheck.error || "رابط الملف غير صالح" }, { status: 400 });
    }
    if (linkCheck.url !== existing.drive_link) {
      sourceChanged = true;
      newDriveLink = linkCheck.url;
    }
  }

  const { data: updatedMaterial, error: updateError } = await supabaseAdmin
    .from("materials")
    .update(metadataPayload)
    .eq("id", id)
    .select(select)
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (sourceChanged) {
    // نُدرج طلب تعديل معلّق للرابط/الملف الجديد ليراجعه المسؤولون قبل استبدال الملف المنشور للعامة
    const subPayload: Record<string, unknown> = {
      user_id: account.user.id,
      submitter_name: account.profile.full_name,
      submitter_email: account.profile.email,
      kind: "material_edit",
      target_material_id: existing.id,
      course_id: existing.course_id,
      title_ar: validated.title_ar,
      description_ar: validated.description_ar,
      type: existing.type,
      academic_year: validated.academic_year,
      semester: validated.semester,
      drive_link: newDriveLink,
      youtube_id: newYoutubeId,
      status: "pending",
    };

    const { error: subErr } = await supabaseAdmin.from("submissions").insert(subPayload);
    if (subErr) {
      // في حال لم يكن عمود target_material_id مضافًا بعد في قاعدة قديمة، ندرجه كمساهمة مادة عادية مع توضيح في العنوان
      await supabaseAdmin.from("submissions").insert({
        user_id: account.user.id,
        kind: "material",
        course_id: existing.course_id,
        title_ar: `${validated.title_ar} (تحديث ملف)`,
        description_ar: validated.description_ar,
        type: existing.type,
        academic_year: validated.academic_year,
        semester: validated.semester,
        drive_link: newDriveLink,
        youtube_id: newYoutubeId,
        status: "pending",
      });
    }

    await logActivity({
      actor: account,
      action: "submission_created",
      target_type: "material",
      target_id: id,
      title_ar: `طلب تحديث رابط/ملف: ${validated.title_ar}`,
      course_id: existing.course_id,
    });

    return NextResponse.json({
      data: flatten(updatedMaterial as Record<string, unknown>),
      pendingLinkReview: true,
      message:
        "تم حفظ تعديلات العنوان والوصف فورًا، بينما أُرسل الرابط/الملف الجديد للمراجعة من قِبل الإدارة قبل ظهوره للعامة.",
    });
  }

  await logActivity({
    actor: account,
    action: "material_edited_by_owner",
    target_type: "material",
    target_id: id,
    title_ar: updatedMaterial.title_ar,
    course_id: updatedMaterial.course_id,
  });

  return NextResponse.json({
    data: flatten(updatedMaterial as Record<string, unknown>),
    pendingLinkReview: false,
  });
}

export async function DELETE(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const incomplete = rejectIfProfileIncomplete(account.profile);
  if (incomplete) return incomplete;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف المادة مطلوب" }, { status: 400 });

  const owned = await loadOwned(id, account.user.id);
  if (owned.error) return owned.error;

  const { error } = await supabaseAdmin.from("materials").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // حذف الملف المرتبط من Google Drive إن كان ضمن مجلد الموقع لمنع تراكم الملفات اليتيمة
  if (owned.data!.drive_link) {
    await deleteDriveFileByLink(owned.data!.drive_link).catch(() => {});
  }

  await logActivity({
    actor: account,
    action: "material_deleted_by_owner",
    target_type: "material",
    target_id: id,
    title_ar: owned.data!.title_ar,
    course_id: owned.data!.course_id,
  });
  return NextResponse.json({ ok: true });
}
