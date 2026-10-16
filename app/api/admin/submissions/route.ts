import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireStaff, getCourseUniversityId, type StaffAccount } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { createUserNotification } from "@/lib/notifications";
import { deleteDriveFileByLink } from "@/lib/googleDrive";
import { normalizeArabic } from "@/lib/arabic";
import { validateLink } from "@/lib/validation";

const select = `id,user_id,submitter_name,submitter_email,kind,course_id,target_material_id,title_ar,description_ar,type,academic_year,semester,drive_link,youtube_id,file_size,mime_type,page_count,status,admin_note,reviewed_by,reviewed_at,created_at,
  suggested_course_name,suggested_course_code,suggested_university_id,
  profiles:user_id(email,full_name),
  courses:course_id(name_ar,code,university_id,universities:university_id(name_ar)),
  suggested_universities:suggested_university_id(name_ar)`;

const selectFallback = `id,user_id,kind,course_id,title_ar,description_ar,type,academic_year,semester,drive_link,youtube_id,status,admin_note,reviewed_by,reviewed_at,created_at,
  suggested_course_name,suggested_course_code,suggested_university_id,
  profiles:user_id(email,full_name),
  courses:course_id(name_ar,code,university_id,universities:university_id(name_ar)),
  suggested_universities:suggested_university_id(name_ar)`;

function flatten(row: Record<string, unknown>) {
  const profile = row.profiles as { email?: string; full_name?: string } | null;
  const course = row.courses as {
    name_ar?: string;
    code?: string;
    university_id?: string;
    universities?: { name_ar?: string };
  } | null;
  const suggestedUni = row.suggested_universities as { name_ar?: string } | null;
  const isCourse = row.kind === "course";

  return {
    ...row,
    email: profile?.email ?? (row.submitter_email as string) ?? "",
    user_name: profile?.full_name ?? (row.submitter_name as string) ?? "",
    course_name: isCourse ? (row.suggested_course_name as string) ?? "" : course?.name_ar ?? "",
    course_code: isCourse ? (row.suggested_course_code as string) ?? "" : course?.code ?? "",
    // جامعة الطلب: للمساق المقترح هي الجامعة المقترح إضافته إليها، وللمواد جامعة مساقها
    university_id: isCourse
      ? (row.suggested_university_id as string | null) ?? null
      : course?.university_id ?? null,
    university_name: isCourse
      ? suggestedUni?.name_ar ?? ""
      : course?.universities?.name_ar ?? "",
  };
}

export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") ?? "pending";

  const runSelect = async (sel: string) => {
    const q = supabaseAdmin.from("submissions").select(sel).order("created_at", { ascending: false });
    return status === "all" ? await q : await q.eq("status", status);
  };

  let { data, error } = await runSelect(select);
  if (error) {
    const fallback = await runSelect(selectFallback);
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    data = fallback.data;
  }

  let items = (data ?? []).map((r) => flatten(r as unknown as Record<string, unknown>));

  // مسؤول الجامعة تصله فقط طلبات جامعته (فلترة على السيرفر)
  if (actor.scopeUniversityId) {
    items = items.filter(
      (x: Record<string, unknown>) => x.university_id === actor.scopeUniversityId
    );
  }

  // كشف تلقائي للتكرار: فحص ما إذا كانت هناك مادة بنفس العنوان (بعد التطبيع العربي) في المساق نفسه
  const pendingCourseIds = Array.from(
    new Set(
      items
        .filter((x: Record<string, unknown>) => x.status === "pending" && x.course_id && x.kind === "material")
        .map((x: Record<string, unknown>) => String(x.course_id))
    )
  );

  const courseMaterialsMap = new Map<string, { title_ar: string; norm: string }[]>();
  if (pendingCourseIds.length > 0) {
    const { data: existingMaterials } = await supabaseAdmin
      .from("materials")
      .select("course_id,title_ar")
      .in("course_id", pendingCourseIds);

    for (const m of existingMaterials ?? []) {
      const list = courseMaterialsMap.get(m.course_id) ?? [];
      list.push({ title_ar: m.title_ar, norm: normalizeArabic(m.title_ar) });
      courseMaterialsMap.set(m.course_id, list);
    }
  }

  const enriched = items.map((item: Record<string, unknown>) => {
    if (item.status !== "pending" || item.kind !== "material" || !item.course_id) {
      return { ...item, duplicate_warning: false, duplicate_titles: [] };
    }
    const existingList = courseMaterialsMap.get(String(item.course_id)) ?? [];
    const normSub = normalizeArabic(String(item.title_ar ?? ""));
    const matches = existingList
      .filter(
        (m) =>
          m.norm === normSub ||
          (normSub.length >= 8 && (m.norm.includes(normSub) || normSub.includes(m.norm)))
      )
      .map((m) => m.title_ar);

    return {
      ...item,
      duplicate_warning: matches.length > 0,
      duplicate_titles: matches,
    };
  });

  return NextResponse.json({ submissions: enriched });
}

async function processSingleSubmission(params: {
  id: string;
  action: "approve" | "reject";
  admin_note?: string;
  overrides?: {
    title_ar?: string;
    description_ar?: string | null;
    course_id?: string;
    academic_year?: string | null;
    semester?: string | null;
    is_verified?: boolean;
  };
  actor: StaffAccount;
}): Promise<{ ok: boolean; status: number; error?: string; data?: unknown }> {
  const { id, action, admin_note, overrides, actor } = params;
  const now = new Date().toISOString();

  // 0) فحص النطاق قبل أي تعديل: مسؤول الجامعة لا يراجع إلا طلبات جامعته،
  //    ولا يستطيع نقل مادة إلى مساق جامعة أخرى عبر overrides.
  if (actor.scopeUniversityId) {
    const { data: pre } = await supabaseAdmin
      .from("submissions")
      .select("id,kind,course_id,suggested_university_id")
      .eq("id", id)
      .maybeSingle();
    if (!pre) return { ok: false, status: 404, error: "المساهمة غير موجودة" };

    const submissionUni =
      pre.kind === "course" ? pre.suggested_university_id : await getCourseUniversityId(pre.course_id);
    if (submissionUni !== actor.scopeUniversityId) {
      return { ok: false, status: 403, error: "هذه المساهمة تتبع جامعة أخرى خارج نطاقك." };
    }
    if (overrides?.course_id) {
      const overrideUni = await getCourseUniversityId(overrides.course_id);
      if (overrideUni !== actor.scopeUniversityId) {
        return { ok: false, status: 403, error: "المساق المختار يتبع جامعة أخرى خارج نطاقك." };
      }
    }
  }

  // 1) حجز ذرّي (Atomic Lock): نحدّث الحالة بشرط أن تكون 'pending' حاليًا لمنع الازدواجية إذا ضغط مسؤولان معًا
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("submissions")
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

  if (claimError) {
    return { ok: false, status: 500, error: claimError.message };
  }
  if (!claimed) {
    return { ok: false, status: 409, error: "تمت مراجعة هذه المساهمة مسبقًا أو تتم مراجعتها الآن" };
  }

  // دالة للتراجع عن الحجز في حال فشل الإدراج اللاحق
  const rollbackClaim = async () => {
    await supabaseAdmin
      .from("submissions")
      .update({ status: "pending", reviewed_by: null, reviewed_at: null })
      .eq("id", id);
  };

  if (action === "approve") {
    if (claimed.kind === "course") {
      const courseName = overrides?.title_ar?.trim() || claimed.suggested_course_name;
      const { data: newCourse, error: courseError } = await supabaseAdmin
        .from("courses")
        .insert({
          name_ar: courseName,
          code: claimed.suggested_course_code,
          university_id: claimed.suggested_university_id,
        })
        .select()
        .single();

      if (courseError) {
        await rollbackClaim();
        return { ok: false, status: 500, error: courseError.message };
      }

      await logActivity({
        actor,
        action: "course_suggestion_approved",
        target_type: "course",
        target_id: newCourse.id,
        title_ar: newCourse.name_ar,
        course_id: newCourse.id,
        university_id: newCourse.university_id,
      });

      await createUserNotification({
        userId: claimed.user_id,
        title: "تمت الموافقة على المساق المقترح ✓",
        message: `تمت إضافة مساق «${newCourse.name_ar}» (${newCourse.code}) إلى المكتبة. شكرًا لمساهمتك!`,
        link: `/universities/${newCourse.university_id}/${newCourse.id}`,
      });
    } else if (claimed.kind === "material_edit" && claimed.target_material_id) {
      // موافقة على تحديث رابط/ملف لمادة منشورة
      if (claimed.type !== "video" && claimed.drive_link) {
        const check = validateLink(claimed.drive_link);
        if (!check.valid) {
          await rollbackClaim();
          return { ok: false, status: 400, error: check.error || "رابط الملف غير صالح" };
        }
      }

      const { data: oldMat } = await supabaseAdmin
        .from("materials")
        .select("drive_link")
        .eq("id", claimed.target_material_id)
        .maybeSingle();

      const { data: updatedMat, error: updateMatError } = await supabaseAdmin
        .from("materials")
        .update({
          title_ar: overrides?.title_ar?.trim() || claimed.title_ar,
          description_ar:
            overrides?.description_ar !== undefined ? overrides.description_ar : claimed.description_ar,
          drive_link: claimed.drive_link,
          youtube_id: claimed.youtube_id,
        })
        .eq("id", claimed.target_material_id)
        .select()
        .single();

      if (updateMatError) {
        await rollbackClaim();
        return { ok: false, status: 500, error: updateMatError.message };
      }

      if (oldMat?.drive_link && oldMat.drive_link !== claimed.drive_link) {
        await deleteDriveFileByLink(oldMat.drive_link).catch(() => {});
      }

      await logActivity({
        actor,
        action: "submission_approved",
        target_type: "material",
        target_id: updatedMat.id,
        title_ar: updatedMat.title_ar,
        course_id: updatedMat.course_id,
      });

      await createUserNotification({
        userId: claimed.user_id,
        title: "تمت الموافقة على تحديث المادة ✓",
        message: `تم اعتماد التحديث على مادة «${updatedMat.title_ar}».`,
        link: `/material/${updatedMat.id}`,
      });
    } else {
      // مساهمة مادة جديدة
      if (claimed.type !== "video" && claimed.drive_link) {
        const check = validateLink(claimed.drive_link);
        if (!check.valid) {
          await rollbackClaim();
          return { ok: false, status: 400, error: check.error || "رابط الملف غير صالح" };
        }
      }

      const finalTitle = overrides?.title_ar?.trim() || claimed.title_ar;
      const finalCourseId = overrides?.course_id || claimed.course_id;
      const finalDesc =
        overrides?.description_ar !== undefined ? overrides.description_ar : claimed.description_ar;
      const finalYear =
        overrides?.academic_year !== undefined ? overrides.academic_year : claimed.academic_year;
      const finalSem = overrides?.semester !== undefined ? overrides.semester : claimed.semester;

      const baseMatPayload = {
        course_id: finalCourseId,
        title_ar: finalTitle,
        description_ar: finalDesc,
        type: claimed.type,
        academic_year: finalYear,
        semester: finalSem,
        drive_link: claimed.drive_link,
        youtube_id: claimed.youtube_id,
        is_featured: false,
        created_by: claimed.user_id,
      };

      const extendedMatPayload = {
        ...baseMatPayload,
        is_verified: overrides?.is_verified ?? true,
        file_size: claimed.file_size ?? null,
        mime_type: claimed.mime_type ?? null,
        page_count: claimed.page_count ?? null,
      };

      let { data: newMaterial, error: insertError } = await supabaseAdmin
        .from("materials")
        .insert(extendedMatPayload)
        .select()
        .single();

      if (insertError) {
        const retry = await supabaseAdmin.from("materials").insert(baseMatPayload).select().single();
        if (retry.error) {
          await rollbackClaim();
          return { ok: false, status: 500, error: retry.error.message };
        }
        newMaterial = retry.data;
      }

      await logActivity({
        actor,
        action: "submission_approved",
        target_type: "material",
        target_id: newMaterial.id,
        title_ar: newMaterial.title_ar,
        course_id: newMaterial.course_id,
      });

      await createUserNotification({
        userId: claimed.user_id,
        title: "تم قبول مساهمتك ونشرها ✓",
        message: `تمت الموافقة على مادة «${newMaterial.title_ar}» وأصبحت متاحة لزملائك في المكتبة.`,
        link: `/material/${newMaterial.id}`,
      });
    }
  } else {
    // عند رفض المساهمة: نحذف ملفها من Google Drive إذا كان مرفوعًا لمجلد الموقع لمنع استهلاك المساحة وبقاء الملف عامًا
    if (claimed.drive_link) {
      await deleteDriveFileByLink(claimed.drive_link).catch(() => {});
    }

    const itemTitle = claimed.title_ar ?? claimed.suggested_course_name ?? "مساهمة";
    await logActivity({
      actor,
      action: "submission_rejected",
      target_type: "submission",
      target_id: claimed.id,
      title_ar: itemTitle,
      course_id: claimed.course_id,
      university_id: claimed.kind === "course" ? claimed.suggested_university_id : undefined,
    });

    await createUserNotification({
      userId: claimed.user_id,
      title: "تحديث بشأن مساهمتك",
      message: `تعذر قبول مساهمة «${itemTitle}»${admin_note ? `. السبب: ${admin_note}` : "."}`,
      link: "/account",
    });
  }

  return { ok: true, status: 200, data: claimed };
}

export async function PATCH(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const { id, ids, action, admin_note, overrides } = body;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  // دعم القبول أو الرفض الجماعي (Bulk Approve/Reject)
  if (Array.isArray(ids) && ids.length > 0) {
    const results = [];
    for (const singleId of ids) {
      const res = await processSingleSubmission({
        id: String(singleId),
        action,
        admin_note,
        actor,
      });
      results.push({ id: singleId, ok: res.ok, error: res.error });
    }
    return NextResponse.json({ results, approvedCount: results.filter((r) => r.ok).length });
  }

  if (!id) return NextResponse.json({ error: "معرّف المساهمة مطلوب" }, { status: 400 });

  const result = await processSingleSubmission({
    id: String(id),
    action,
    admin_note,
    overrides,
    actor,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ submission: result.data });
}
