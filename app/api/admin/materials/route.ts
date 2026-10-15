import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { extractYoutubeId } from "@/lib/youtube";
import { validateLink, validateMaterialInput } from "@/lib/validation";
import { deleteDriveFileByLink } from "@/lib/googleDrive";

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
  if (!(await requireRole(req, ["admin", "owner"]))) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") ?? "";
  const featured = searchParams.get("featured") ?? "";
  const universityId = searchParams.get("university_id") ?? searchParams.get("university") ?? "";
  const courseIdParam = searchParams.get("course_id") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize") ?? 12)));
  const from = (page - 1) * pageSize;

  let courseIds: string[] | null = null;
  if (courseIdParam) {
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

  function scoped<T extends { in: (col: string, vals: string[]) => T; eq: (col: string, val: string) => T }>(
    builder: T
  ): T {
    if (!courseIds) return builder;
    return courseIds.length
      ? builder.in("course_id", courseIds)
      : builder.eq("course_id", "00000000-0000-0000-0000-000000000000");
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
      supabaseAdmin.from("universities").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("courses").select("id", { count: "exact", head: true }),
    ]);

  if (materialsResult.error) {
    materialsResult = await buildQuery(selectFallback);
  }
  if (materialsResult.error) {
    return NextResponse.json({ error: materialsResult.error.message }, { status: 500 });
  }
  if (downloadsResult.error) {
    return NextResponse.json({ error: downloadsResult.error.message }, { status: 500 });
  }

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
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const { course_id, drive_link, youtube_input, is_featured, is_verified, file_size, mime_type } = body;
  if (!course_id) return NextResponse.json({ error: "المساق مطلوب" }, { status: 400 });

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
    file_size: typeof file_size === "number" && file_size > 0 ? file_size : null,
    mime_type: typeof mime_type === "string" && mime_type ? mime_type : null,
  };

  let { data, error } = await supabaseAdmin
    .from("materials")
    .insert(extendedPayload)
    .select(select)
    .single();

  if (error) {
    const retry = await supabaseAdmin
      .from("materials")
      .insert(basePayload)
      .select(selectFallback)
      .single();
    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
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
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const { id, course_id, drive_link, youtube_input, is_featured, is_verified } = body;
  if (!id || !course_id) return NextResponse.json({ error: "الحقول الأساسية ناقصة" }, { status: 400 });

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

  let { data, error } = await supabaseAdmin
    .from("materials")
    .update(extendedPayload)
    .eq("id", id)
    .select(select)
    .single();

  if (error) {
    const retry = await supabaseAdmin
      .from("materials")
      .update(basePayload)
      .eq("id", id)
      .select(selectFallback)
      .single();
    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
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
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف المادة مطلوب" }, { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("materials")
    .select("id,title_ar,course_id,drive_link")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("materials").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // حذف الملف من Google Drive إن كان ضمن مجلد الموقع لمنع تكدس الملفات المحذوفة
  if (existing?.drive_link) {
    await deleteDriveFileByLink(existing.drive_link).catch(() => {});
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
