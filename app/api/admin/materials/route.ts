import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1).match(/^[\w-]{11}/)?.[0] ?? null;
    if (url.searchParams.get("v")) return url.searchParams.get("v");
    const match = url.pathname.match(/\/(?:shorts|embed)\/([\w-]{11})/);
    return match?.[1] ?? null;
  } catch { return null; }
}

const select = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, downloads_count, created_at,
  courses:course_id (
    name_ar, code,
    faculties:faculty_id (
      name_ar,
      universities:university_id ( name_ar )
    )
  )
`;

function flatten(row: any) {
  return {
    ...row,
    course_name: row.courses?.name_ar ?? null,
    course_code: row.courses?.code ?? null,
    faculty_name: row.courses?.faculties?.name_ar ?? null,
    university_name: row.courses?.faculties?.universities?.name_ar ?? null,
  };
}

export async function GET(req: NextRequest) {
  if (!(await requireRole(req, ["admin","owner"]))) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") ?? "";
  const featured = searchParams.get("featured") ?? "";
  // Accept both "university" and "university_id" for backwards compatibility.
  const universityId = searchParams.get("university_id") ?? searchParams.get("university") ?? "";
  const courseId = searchParams.get("course_id") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize") ?? 12)));
  const from = (page - 1) * pageSize;

  // When scoped to a university, resolve it down to a concrete list of course
  // ids once, then reuse that scope both for the paginated items query and
  // for the aggregate stats below, so the stats actually reflect that
  // university instead of the whole platform.
  let courseIds: string[] | null = null;
  if (universityId) {
    const { data: faculties } = await supabaseAdmin.from("faculties").select("id").eq("university_id", universityId);
    const facultyIds = (faculties ?? []).map((f: any) => f.id);
    const { data: courses } = facultyIds.length
      ? await supabaseAdmin.from("courses").select("id").in("faculty_id", facultyIds)
      : { data: [] as any[] };
    courseIds = (courses ?? []).map((c: any) => c.id);
  }

  let query = supabaseAdmin.from("materials").select(select, { count: "exact" }).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  if (courseId) query = query.eq("course_id", courseId);
  else if (courseIds) {
    query = courseIds.length ? query.in("course_id", courseIds) : query.eq("course_id", "00000000-0000-0000-0000-000000000000");
  }
  if (q) query = query.ilike("title_ar", `%${q}%`);
  if (type) query = query.eq("type", type);
  if (featured === "true") query = query.eq("is_featured", true);
  if (featured === "false") query = query.eq("is_featured", false);

  function scoped(builder: any) {
    if (!courseIds) return builder;
    return courseIds.length ? builder.in("course_id", courseIds) : builder.eq("course_id", "00000000-0000-0000-0000-000000000000");
  }

  const [materialsResult, totalResult, featuredResult, downloadsResult, universitiesResult, facultiesResult, coursesResult] = await Promise.all([
    query,
    scoped(supabaseAdmin.from("materials").select("id", { count: "exact", head: true })),
    scoped(supabaseAdmin.from("materials").select("id", { count: "exact", head: true }).eq("is_featured", true)),
    scoped(supabaseAdmin.from("materials").select("downloads_count")),
    supabaseAdmin.from("universities").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("faculties").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("courses").select("id", { count: "exact", head: true }),
  ]);

  if (materialsResult.error) return NextResponse.json({ error: materialsResult.error.message }, { status: 500 });
  if (downloadsResult.error) return NextResponse.json({ error: downloadsResult.error.message }, { status: 500 });

  const downloads = (downloadsResult.data ?? []).reduce((sum: number, item: { downloads_count: number | null }) => sum + Number(item.downloads_count ?? 0), 0);
  const stats = {
    // "materials" / "featured" / "downloads" are scoped to the requested
    // university when university_id is given, so per-university dashboards
    // show that university's real numbers instead of platform-wide totals.
    materials: totalResult.count ?? 0,
    featured: featuredResult.count ?? 0,
    downloads,
    // These remain platform-wide counts (used for the general overview).
    universities: universitiesResult.count ?? 0,
    faculties: facultiesResult.count ?? 0,
    courses: coursesResult.count ?? 0,
  };

  const items = (materialsResult.data ?? []).map(flatten);
  return NextResponse.json({ items, count: materialsResult.count ?? 0, page, pageSize, stats });
}

export async function POST(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const { course_id, title_ar, description_ar, type, academic_year, semester, drive_link, youtube_input, is_featured } = body;
  if (!course_id || !title_ar || !type) return NextResponse.json({ error: "الحقول الأساسية ناقصة" }, { status: 400 });

  const payload: Record<string, unknown> = {
    course_id, title_ar, description_ar: description_ar || null, type,
    academic_year: academic_year || null, semester: semester || null,
    is_featured: Boolean(is_featured), drive_link: null, youtube_id: null,
  };

  if (type === "video") {
    const youtubeId = extractYoutubeId(String(youtube_input ?? ""));
    if (!youtubeId) return NextResponse.json({ error: "رابط YouTube غير صالح" }, { status: 400 });
    payload.youtube_id = youtubeId;
  } else {
    if (!drive_link) return NextResponse.json({ error: "رابط Google Drive مطلوب" }, { status: 400 });
    payload.drive_link = drive_link;
  }

  const { data, error } = await supabaseAdmin.from("materials").insert(payload).select(select).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from("publication_logs").insert({actor_id: actor.user.id, action:"material_published", material_id:data.id, course_id, details:{title_ar}});
  return NextResponse.json({ data: flatten(data) });
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const body = await req.json();
  const { id, course_id, title_ar, description_ar, type, academic_year, semester, drive_link, youtube_input, is_featured } = body;
  if (!id || !course_id || !title_ar || !type) return NextResponse.json({ error: "الحقول الأساسية ناقصة" }, { status: 400 });

  const payload: Record<string, unknown> = {
    course_id, title_ar, description_ar: description_ar || null, type,
    academic_year: academic_year || null, semester: semester || null,
    is_featured: Boolean(is_featured), drive_link: null, youtube_id: null,
  };
  if (type === "video") {
    const youtubeId = extractYoutubeId(String(youtube_input ?? ""));
    if (!youtubeId) return NextResponse.json({ error: "رابط YouTube غير صالح" }, { status: 400 });
    payload.youtube_id = youtubeId;
  } else {
    if (!drive_link) return NextResponse.json({ error: "رابط Google Drive مطلوب" }, { status: 400 });
    payload.drive_link = drive_link;
  }

  const { data, error } = await supabaseAdmin.from("materials").update(payload).eq("id", id).select(select).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from("publication_logs").insert({actor_id: actor.user.id, action:"material_updated", material_id:id, course_id, details:{title_ar}});
  return NextResponse.json({ data: flatten(data) });
}

export async function DELETE(req: NextRequest) {
  const actor = await requireRole(req, ["admin","owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "معرّف المادة مطلوب" }, { status: 400 });
  const { data: existing } = await supabaseAdmin.from("materials").select("course_id,title_ar").eq("id", id).maybeSingle();
  const { error } = await supabaseAdmin.from("materials").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from("publication_logs").insert({actor_id: actor.user.id, action:"material_deleted", course_id:existing?.course_id||null, details:{title_ar:existing?.title_ar||null}});
  return NextResponse.json({ ok: true });
}
