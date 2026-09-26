import { supabase } from "@/lib/supabase/client";
import type { Course, Faculty, Material, MaterialType, University } from "@/lib/types";

export async function getUniversities(): Promise<University[]> {
  const { data, error } = await supabase
    .from("universities")
    .select("*")
    .order("name_ar", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getFaculties(universityId?: string): Promise<Faculty[]> {
  let query = supabase.from("faculties").select("*").order("name_ar", { ascending: true });
  if (universityId) query = query.eq("university_id", universityId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getCourses(facultyId?: string): Promise<Course[]> {
  let query = supabase.from("courses").select("*").order("name_ar", { ascending: true });
  if (facultyId) query = query.eq("faculty_id", facultyId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export interface MaterialFilters {
  q?: string;
  universityId?: string;
  facultyId?: string;
  courseId?: string;
  type?: MaterialType;
  semester?: string;
  academicYear?: string;
  page?: number;
  pageSize?: number;
}

// Joins course -> faculty -> university names onto each material so cards and
// filters can show readable Arabic labels without extra round trips.
const MATERIAL_SELECT = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, downloads_count, created_at,
  courses:course_id (
    name_ar,
    faculties:faculty_id (
      name_ar,
      universities:university_id ( name_ar )
    )
  )
`;

function flattenMaterial(row: any): Material {
  return {
    ...row,
    course_name: row.courses?.name_ar,
    faculty_name: row.courses?.faculties?.name_ar,
    university_name: row.courses?.faculties?.universities?.name_ar,
  };
}

export async function getFeaturedMaterials(limit = 10): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(MATERIAL_SELECT)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(flattenMaterial);
}

export async function getRecentMaterials(limit = 8): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(MATERIAL_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(flattenMaterial);
}

// PostgREST can't cleanly filter on a column two joins away (university_id
// through faculties -> courses), so when a university or faculty filter is
// given we first resolve it down to a concrete list of course ids.
async function resolveCourseIdsForFilter(
  universityId?: string,
  facultyId?: string
): Promise<string[] | null> {
  if (!universityId && !facultyId) return null;

  let facultyIds: string[] | undefined;
  if (facultyId) {
    facultyIds = [facultyId];
  } else if (universityId) {
    const { data, error } = await supabase
      .from("faculties")
      .select("id")
      .eq("university_id", universityId);
    if (error) throw error;
    facultyIds = (data ?? []).map((f) => f.id);
    if (facultyIds.length === 0) return [];
  }

  if (!facultyIds) return null;

  const { data, error } = await supabase.from("courses").select("id").in("faculty_id", facultyIds);
  if (error) throw error;
  return (data ?? []).map((c) => c.id);
}

export async function searchMaterials(
  filters: MaterialFilters
): Promise<{ items: Material[]; count: number }> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 12;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const scopedCourseIds = await resolveCourseIdsForFilter(filters.universityId, filters.facultyId);
  if (scopedCourseIds && scopedCourseIds.length === 0) {
    return { items: [], count: 0 };
  }

  let query = supabase
    .from("materials")
    .select(MATERIAL_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.q) {
    const term = filters.q.trim();
    const [{ data: titleMatches }, { data: courseMatches }] = await Promise.all([
      supabase.from("materials").select("id").ilike("title_ar", `%${term}%`),
      supabase.from("courses").select("id").or(`name_ar.ilike.%${term}%,code.ilike.%${term}%`),
    ]);
    const ids = [...new Set([...(titleMatches ?? []).map((x:any)=>x.id), ...((courseMatches ?? []).map((x:any)=>x.id))])];
    if (!ids.length) return { items: [], count: 0 };
    query = query.in("id", ids);
  }
  if (filters.courseId) query = query.eq("course_id", filters.courseId);
  else if (scopedCourseIds) query = query.in("course_id", scopedCourseIds);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.semester) query = query.eq("semester", filters.semester);
  if (filters.academicYear) query = query.eq("academic_year", filters.academicYear);

  const { data, error, count } = await query;
  if (error) throw error;

  return { items: (data ?? []).map(flattenMaterial), count: count ?? 0 };
}

export async function getMaterialById(id: string): Promise<Material | null> {
  const { data, error } = await supabase
    .from("materials")
    .select(MATERIAL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? flattenMaterial(data) : null;
}

export async function incrementDownloads(id: string): Promise<void> {
  await supabase.rpc("increment_downloads", { material_id: id });
}
