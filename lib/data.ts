import { supabase } from "@/lib/supabase/client";
import type { Course, Doctor, Material, MaterialType, University } from "@/lib/types";
import {
  MOCK_UNIVERSITIES,
  MOCK_COURSES,
  MOCK_MATERIALS,
  MOCK_DOCTORS,
} from "./mockData";

export const isSupabaseLive = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("xxxxxxxxxxxx") && url.startsWith("https://"));
};

export async function getUniversities(): Promise<University[]> {
  if (!isSupabaseLive()) return MOCK_UNIVERSITIES;
  try {
    const { data, error } = await supabase
      .from("universities")
      .select("*")
      .order("name_ar", { ascending: true });
    if (error) throw error;
    return data && data.length > 0 ? data : MOCK_UNIVERSITIES;
  } catch {
    return MOCK_UNIVERSITIES;
  }
}

export async function getCourses(universityId?: string): Promise<Course[]> {
  const mock = () => (universityId ? MOCK_COURSES.filter((c) => c.university_id === universityId) : MOCK_COURSES);
  if (!isSupabaseLive()) return mock();
  try {
    let query = supabase.from("courses").select("*").order("name_ar", { ascending: true });
    if (universityId) query = query.eq("university_id", universityId);
    const { data, error } = await query;
    if (error) throw error;
    return data && data.length > 0 ? data : mock();
  } catch {
    return mock();
  }
}

export async function getUniversityById(id: string): Promise<University | null> {
  if (!isSupabaseLive()) {
    return MOCK_UNIVERSITIES.find((u) => u.id === id) ?? null;
  }
  try {
    const { data, error } = await supabase.from("universities").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ?? MOCK_UNIVERSITIES.find((u) => u.id === id) ?? null;
  } catch {
    return MOCK_UNIVERSITIES.find((u) => u.id === id) ?? null;
  }
}

export async function getCourseById(id: string): Promise<Course | null> {
  if (!isSupabaseLive()) {
    return MOCK_COURSES.find((c) => c.id === id) ?? null;
  }
  try {
    const { data, error } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ?? MOCK_COURSES.find((c) => c.id === id) ?? null;
  } catch {
    return MOCK_COURSES.find((c) => c.id === id) ?? null;
  }
}

export interface CourseSearchResult extends Course {
  university_name: string;
}

export async function searchCourses(q: string, universityId?: string): Promise<CourseSearchResult[]> {
  const term = q.trim().toLowerCase();
  if (!term) return [];

  const fromMock = () =>
    MOCK_COURSES.filter(
      (c) =>
        (!universityId || c.university_id === universityId) &&
        (c.name_ar.toLowerCase().includes(term) || (c.code && c.code.toLowerCase().includes(term)))
    ).map((c) => ({
      ...c,
      university_name: MOCK_UNIVERSITIES.find((u) => u.id === c.university_id)?.name_ar ?? "",
    }));

  if (!isSupabaseLive()) return fromMock();

  try {
    // نُزيل الفواصل والأقواس من النص حتى لا تكسر صيغة or() في PostgREST.
    const safe = term.replace(/[,()%*]/g, " ").trim();
    let query = supabase
      .from("courses")
      .select("*, universities:university_id(name_ar)")
      .or(`name_ar.ilike.%${safe}%,code.ilike.%${safe}%`)
      .order("name_ar", { ascending: true })
      .limit(25);
    if (universityId) query = query.eq("university_id", universityId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      ...row,
      university_name: row.universities?.name_ar ?? "",
    }));
  } catch {
    return fromMock();
  }
}

export interface MaterialFilters {
  q?: string;
  universityId?: string;
  courseId?: string;
  type?: MaterialType;
  semester?: string;
  academicYear?: string;
  page?: number;
  pageSize?: number;
}

const MATERIAL_SELECT = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, downloads_count, created_at,
  courses:course_id!inner (
    name_ar, code, university_id,
    universities:university_id ( name_ar )
  )
`;

function flattenMaterial(row: any): Material {
  return {
    ...row,
    course_name: row.courses?.name_ar ?? row.course_name,
    course_code: row.courses?.code ?? row.course_code,
    university_name: row.courses?.universities?.name_ar ?? row.university_name,
  };
}

export async function getFeaturedMaterials(limit = 10): Promise<Material[]> {
  if (!isSupabaseLive()) {
    return MOCK_MATERIALS.filter((m) => m.is_featured).slice(0, limit);
  }
  try {
    const { data, error } = await supabase
      .from("materials")
      .select(MATERIAL_SELECT)
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const res = (data ?? []).map(flattenMaterial);
    return res.length > 0 ? res : MOCK_MATERIALS.filter((m) => m.is_featured).slice(0, limit);
  } catch {
    return MOCK_MATERIALS.filter((m) => m.is_featured).slice(0, limit);
  }
}

export async function getRecentMaterials(limit = 8): Promise<Material[]> {
  if (!isSupabaseLive()) {
    return MOCK_MATERIALS.slice(0, limit);
  }
  try {
    const { data, error } = await supabase
      .from("materials")
      .select(MATERIAL_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const res = (data ?? []).map(flattenMaterial);
    return res.length > 0 ? res : MOCK_MATERIALS.slice(0, limit);
  } catch {
    return MOCK_MATERIALS.slice(0, limit);
  }
}

export async function searchMaterials(
  filters: MaterialFilters = {}
): Promise<{ items: Material[]; count: number }> {
  if (!isSupabaseLive()) {
    let items = [...MOCK_MATERIALS];
    if (filters.type) items = items.filter((m) => m.type === filters.type);
    if (filters.courseId) items = items.filter((m) => m.course_id === filters.courseId);
    if (filters.universityId) {
      const ids = MOCK_COURSES.filter((c) => c.university_id === filters.universityId).map((c) => c.id);
      items = items.filter((m) => ids.includes(m.course_id));
    }
    if (filters.semester) items = items.filter((m) => m.semester === filters.semester);
    if (filters.academicYear) items = items.filter((m) => m.academic_year === filters.academicYear);
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      items = items.filter(
        (m) =>
          m.title_ar.toLowerCase().includes(q) ||
          (m.course_name && m.course_name.toLowerCase().includes(q))
      );
    }
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 12;
    const from = (page - 1) * pageSize;
    return { items: items.slice(from, from + pageSize), count: items.length };
  }

  try {
    let query = supabase.from("materials").select(MATERIAL_SELECT, { count: "exact" });
    if (filters.courseId) query = query.eq("course_id", filters.courseId);
    if (filters.universityId) query = query.eq("courses.university_id", filters.universityId);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.semester) query = query.eq("semester", filters.semester);
    if (filters.academicYear) query = query.eq("academic_year", filters.academicYear);
    if (filters.q?.trim()) query = query.ilike("title_ar", `%${filters.q.trim()}%`);

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 12;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    return {
      items: (data ?? []).map(flattenMaterial),
      count: count ?? 0,
    };
  } catch {
    return { items: MOCK_MATERIALS, count: MOCK_MATERIALS.length };
  }
}

export async function getMaterialById(id: string): Promise<Material | null> {
  if (!isSupabaseLive()) {
    return MOCK_MATERIALS.find((m) => m.id === id) ?? null;
  }
  try {
    const { data, error } = await supabase
      .from("materials")
      .select(MATERIAL_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? flattenMaterial(data) : MOCK_MATERIALS.find((m) => m.id === id) ?? null;
  } catch {
    return MOCK_MATERIALS.find((m) => m.id === id) ?? null;
  }
}

export async function incrementDownloads(id: string): Promise<void> {
  if (!isSupabaseLive()) return;
  try {
    await supabase.rpc("increment_downloads", { material_id: id });
  } catch {}
}

export interface DoctorFilters {
  q?: string;
  universityId?: string;
}

const DOCTOR_SELECT = `
  id, full_name, email, phone, office_location, university_id, courses, created_at, updated_at,
  universities:university_id ( name_ar )
`;

function flattenDoctor(row: any): Doctor {
  return {
    ...row,
    university_name: row.universities?.name_ar ?? row.university_name,
  };
}

export async function searchDoctors(filters: DoctorFilters = {}): Promise<Doctor[]> {
  if (!isSupabaseLive()) {
    let docs = [...MOCK_DOCTORS];
    if (filters.universityId) docs = docs.filter((d) => d.university_id === filters.universityId);
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      docs = docs.filter((d) => d.full_name.toLowerCase().includes(q));
    }
    return docs;
  }
  try {
    let query = supabase.from("doctors").select(DOCTOR_SELECT).order("full_name", { ascending: true });
    if (filters.universityId) query = query.eq("university_id", filters.universityId);
    if (filters.q?.trim()) query = query.ilike("full_name", `%${filters.q.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(flattenDoctor);
  } catch {
    return MOCK_DOCTORS;
  }
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  if (!isSupabaseLive()) {
    return MOCK_DOCTORS.find((d) => d.id === id) ?? null;
  }
  try {
    const { data, error } = await supabase.from("doctors").select(DOCTOR_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? flattenDoctor(data) : MOCK_DOCTORS.find((d) => d.id === id) ?? null;
  } catch {
    return MOCK_DOCTORS.find((d) => d.id === id) ?? null;
  }
}
