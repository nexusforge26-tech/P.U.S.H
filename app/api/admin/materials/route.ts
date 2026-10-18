import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireStaff, getCourseUniversityId, forbiddenOutOfScope } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { extractYoutubeId } from "@/lib/youtube";
import { validateLink, validateMaterialInput } from "@/lib/validation";
import { deleteDriveFileIfUnreferenced } from "@/lib/driveCleanup";
import { badRequest, isUuid, safeJson, sanitizeFilterTerm, serverError } from "@/lib/security";

const select = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, is_verified, downloads_count, helpful_count,
  file_size, mime_type, page_count, created_at, created_by,
  courses:course_id (
    name_ar, code,
    universities:university_id ( name_ar )
  )
`;

const selectFallback = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, downloads_count, created_at, created_by,
  courses:course_id (
    name_ar, code,
    universities:university_id ( name_ar )
  )
`;

function flatten(row: Record<string, unknown>) {
  const course = row.courses as { name_ar?: string; code?: string; universities?: { name_ar?: string } } | null;
  return {
    ...row,
    course_name: course?.name_ar ?? null,
    course_code: course?.code ?? null,
    university_name: course?.universities?.name_ar ?? null,
  };
}

export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const scope = actor.scopeUniversityId;

  const { searchParams } = new URL(req.url);
  const q = sanitizeFilterTerm(searchParams.get("q") ?? "", 100);
  const type = ["exam", "summary", "file", "video"].includes(searchParams.get("type") ?? "") ? (searchParams.get("type") as string) : "";
  const featured = searchParams.get("featured") ?? "";
  // مسؤول الجامعة: نتجاهل أي university_id مُمرَّر ونفرض جامعته
  const rawUniversityId = scope ?? searchParams.get("university_id") ?? searchParams.get("university") ?? "";
  const universityId = isUuid(rawUniversityId) ? rawUniversityId : "";
  const rawCourseId = searchParams.get("course_id") ?? "";
  const courseIdParam = isUuid(rawCourseId) ? rawCourseId : "";
  const page = Math.max(1, Math.floor(Number(searchParams.get("page") ?? 1)) || 1);
  const pageSize = Math.min(50, Math.max(5, Math.floor(Number(searchParams.get("pageSize") ?? 12)) || 12));
  const from = (page - 1) * pageSize;

  let courseIds: string[] | null = null;
  if (courseIdParam) {
    if (scope && (await getCourseUniversityId(courseIdParam)) !== scope) {
      return forbiddenOutOfScope();
    }
    courseIds = [courseIdParam];
  } else if (universityId) {
    const { data: courses } = await supabaseAdmin
      .from("courses")
      .select("id")
      .eq("university_id", universityId);
    courseIds = (courses ?? []).map((c: { id: string }) => c.id);
  }

  const buildQuery = (sel: string) => {
    let query = supabaseAdmin
      .from("materials")
      .select(sel, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (courseIds) {
      query = courseIds.length
        ? query.in("course_id", courseIds)
        : query.eq("course_id", "00000000-0000-0000-0000-000000000000");
    }
    if (q) query = query.ilike("title_ar", `%${q}%`);
    if (type) query = query.eq("type", type);
    if (featured === "true") query = query.eq("is_featured", true);
    if (featured === "false") query = query.eq("is_featured", false);
    return query;
  };

  function scoped<B>(builder: B): B {
    if (!courseIds) return builder;
    const b = builder as unknown as {
      in: (col: string, vals: string[]) => unknown;
      eq: (col: string, val: string) => unknown;
    };
    return (
      courseIds.length
        ? b.in("course_id", courseIds)
        : b.eq("course_id", "00000000-0000-0000-0000-000000000000")
    ) as B;
  }

  let [materialsResult, totalResult, featuredResult, downloadsResult, universitiesResult, coursesResult] =
    await Promise.all([
      buildQuery(select),
      scoped(supabaseAdmin.from("materials").select("id", { count: "exact", head: true })),
      scoped(
        supabaseAdmin
          .from("materials")
          .select("id", { count: "exact", head: true })
          .eq("is_featured", true)
      ),
      scoped(supabaseAdmin.from("materials").select("downloads_count")),
      scope
        ? supabaseAdmin.from("universities").select("id", { count: "exact", head: true }).eq("id", scope)
        : supabaseAdmin.from("universities").select("id", { count: "exact", head: true }),
      scope
        ? supabaseAdmin.from("courses").select("id", { count: "exact", head: true }).eq("university_id", scope)
        : supabaseAdmin.from("courses").select("id", { count: "exact", head: true }),
    ]);

  if (materialsResult.error) {
    materialsResult = await buildQuery(selectFallback);
  }
  if (materialsResult.error) return serverError(materialsResult.error);
  if (downloadsResult.error) return serverError(downloadsResult.error);

  const downloads = (downloadsResult.data ?? []).reduce(
    (sum: number, item: { downloads_count: number | null }) => sum + Number(item.downloads_count ?? 0),
    0
  );
  const stats = {
    materials: totalResult.count ?? 0,
    featured: featuredResult.count ?? 0,
    downloads,
    universities: universitiesResult.count ?? 0,
    courses: coursesResult.count ?? 0,
  };

  const items = (materialsResult.data ?? []).map((r) => flatten(r as unknown as Record<string, unknown>));
  return NextResponse.json({ items, count: materialsResult.count ?? 0, page, pageSize, stats });
}

export async function POST(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await safeJson<Record<string, any>>(req);
  if (!body) return badRequest();
  const { course_id, drive_link, youtube_input, is_featured, is_verified, file_size, mime_type } = body;
  if (!course_id) return NextResponse.json({ error: "المساق مطلوب" }, { status: 400 });
  if (!isUuid(course_id)) return badRequest("المساق غير صالح");
  if (actor.scopeUniversityId && (await getCourseUniversityId(course_id)) !== actor.scopeUniversityId) {
    return forbiddenOutOfScope();
  }

  const validated = validateMaterialInput(body);
  if (!validated.valid || !validated.type) {
    return NextResponse.json({ error: validated.error || "الحقول الأساسية ناقصة" }, { status: 400 });
  }

  const basePayload: Record<string, unknown> = {
    course_id,
    title_ar: validated.title_ar,
    description_ar: validated.description_ar,
    type: validated.type,
    academic_year: validated.academic_year,
    semester: validated.semester,
    is_featured: Boolean(is_featured),
    drive_link: null,
    youtube_id: null,
    created_by: actor.user.id,
  };

  if (validated.type === "video") {
    const youtubeId = extractYoutubeId(String(youtube_input ?? ""));
    if (!youtubeId) return NextResponse.json({ error: "رابط YouTube غير صالح" }, { status: 400 });
    basePayload.youtube_id = youtubeId;
  } else {
    const linkCheck = validateLink(drive_link);
    if (!linkCheck.valid || !linkCheck.url) {
      return NextResponse.json({ error: linkCheck.error || "رابط الملف غير صالح" }, { status: 400 });
    }
    basePayload.drive_link = linkCheck.url;
  }

  const extendedPayload = {
    ...basePayload,
    is_verified: is_verified !== undefined ? Boolean(is_verified) : true,
    file_size: typeof file_size === "number" && Number.isFinite(file_size) && file_size > 0 ? Math.round(file_size) : null,
    mime_type: typeof mime_type === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(mime_type.trim()) ? mime_type.trim().slice(0, 150) : null,
  };

  const first = await supabaseAdmin
    .from("materials")
    .insert(extendedPayload)
    .select(select)
    .single();
  let data: unknown = first.data;

  if (first.error) {
    const retry = await supabaseAdmin
      .from("materials")
      .insert(basePayload)
      .select(selectFallback)
      .single();
    if (retry.error) return serverError(retry.error);
    data = retry.data;
  }

  const row = data as unknown as Record<string, unknown>;
  await logActivity({
    actor,
    action: "material_added",
    target_type: "material",
    target_id: String(row.id),
    title_ar: String(row.title_ar),
    course_id: String(row.course_id),
  });
  return NextResponse.json({ data: flatten(row) });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await safeJson<Record<string, any>>(req);
  if (!body) return badRequest();
  const { id, course_id, drive_link, youtube_input, is_featured, is_verified } = body;
  if (!id || !course_id) return NextResponse.json({ error: "الحقول الأساسية ناقصة" }, { status: 400 });
  if (!isUuid(id) || !isUuid(course_id)) return badRequest("معرّف غير صالح");
  if (actor.scopeUniversityId) {
    // المادة الحالية والمساق الجديد كلاهما يجب أن يتبعا جامعة مسؤول الجامعة
    const { data: current } = await supabaseAdmin.from("materials").select("course_id").eq("id", id).maybeSingle();
    if (
      !current ||
      (await getCourseUniversityId(current.course_id)) !== actor.scopeUniversityId ||
      (await getCourseUniversityId(course_id)) !== actor.scopeUniversityId
    ) {
      return forbiddenOutOfScope();
    }
  }

  const validated = validateMaterialInput(body);
  if (!validated.valid || !validated.type) {
    return NextResponse.json({ error: validated.error || "الحقول الأساسية ناقصة" }, { status: 400 });
  }

  const basePayload: Record<string, unknown> = {
    course_id,
    title_ar: validated.title_ar,
    description_ar: validated.description_ar,
    type: validated.type,
    academic_year: validated.academic_year,
    semester: validated.semester,
    is_featured: Boolean(is_featured),
    drive_link: null,
    youtube_id: null,
  };

  if (validated.type === "video") {
    const youtubeId = extractYoutubeId(String(youtube_input ?? ""));
    if (!youtubeId) return NextResponse.json({ error: "رابط YouTube غير صالح" }, { status: 400 });
    basePayload.youtube_id = youtubeId;
  } else {
    const linkCheck = validateLink(drive_link);
    if (!linkCheck.valid || !linkCheck.url) {
      return NextResponse.json({ error: linkCheck.error || "رابط الملف غير صالح" }, { status: 400 });
    }
    basePayload.drive_link = linkCheck.url;
  }

  const extendedPayload =
    is_verified !== undefined ? { ...basePayload, is_verified: Boolean(is_verified) } : basePayload;

  const first = await supabaseAdmin
    .from("materials")
    .update(extendedPayload)
    .eq("id", id)
    .select(select)
    .single();
  let data: unknown = first.data;

  if (first.error) {
    const retry = await supabaseAdmin
      .from("materials")
      .update(basePayload)
      .eq("id", id)
      .select(selectFallback)
      .single();
    if (retry.error) return serverError(retry.error);
    data = retry.data;
  }

  const row = data as unknown as Record<string, unknown>;
  await logActivity({
    actor,
    action: "material_updated",
    target_type: "material",
    target_id: String(row.id),
    title_ar: String(row.title_ar),
    course_id: String(row.course_id),
  });
  return NextResponse.json({ data: flatten(row) });
}

export async function DELETE(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف المادة مطلوب" }, { status: 400 });
  if (!isUuid(id)) return badRequest("معرّف المادة غير صالح");

  const { data: existing } = await supabaseAdmin
    .from("materials")
    .select("id,title_ar,course_id,drive_link")
    .eq("id", id)
    .maybeSingle();

  if (actor.scopeUniversityId) {
    if (!existing || (await getCourseUniversityId(existing.course_id)) !== actor.scopeUniversityId) {
      return forbiddenOutOfScope();
    }
  }

  const { error } = await supabaseAdmin.from("materials").delete().eq("id", id);
  if (error) return serverError(error);

  // حذف الملف من Google Drive لمنع تكدس الملفات المحذوفة — فقط إن لم تشر إليه مادة/مساهمة أخرى
  if (existing?.drive_link) {
    await deleteDriveFileIfUnreferenced(existing.drive_link, { excludeMaterialId: id }).catch(() => {});
  }

  await logActivity({
    actor,
    action: "material_deleted",
    target_type: "material",
    target_id: id,
    title_ar: existing?.title_ar ?? null,
    course_id: existing?.course_id ?? null,
  });
  return NextResponse.json({ ok: true });
}
