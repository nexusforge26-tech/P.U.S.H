import { supabase } from "@/lib/supabase/client";
import type { Course, Doctor, Faculty, Material, MaterialType, University } from "@/lib/types";
import {
  MOCK_UNIVERSITIES,
  MOCK_FACULTIES,
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

export async function getFaculties(universityId?: string): Promise<Faculty[]> {
  if (!isSupabaseLive()) {
    return universityId
      ? MOCK_FACULTIES.filter((f) => f.university_id === universityId)
      : MOCK_FACULTIES;
  }
  try {
    let query = supabase.from("faculties").select("*").order("name_ar", { ascending: true });
    if (universityId) query = query.eq("university_id", universityId);
    const { data, error } = await query;
    if (error) throw error;
    return data && data.length > 0
      ? data
      : universityId
      ? MOCK_FACULTIES.filter((f) => f.university_id === universityId)
      : MOCK_FACULTIES;
  } catch {
    return universityId
      ? MOCK_FACULTIES.filter((f) => f.university_id === universityId)
      : MOCK_FACULTIES;
  }
}

export async function getCourses(facultyId?: string): Promise<Course[]> {
  if (!isSupabaseLive()) {
    return facultyId ? MOCK_COURSES.filter((c) => c.faculty_id === facultyId) : MOCK_COURSES;
  }
  try {
    let query = supabase.from("courses").select("*").order("name_ar", { ascending: true });
    if (facultyId) query = query.eq("faculty_id", facultyId);
    const { data, error } = await query;
    if (error) throw error;
    return data && data.length > 0
      ? data
      : facultyId
      ? MOCK_COURSES.filter((c) => c.faculty_id === facultyId)
      : MOCK_COURSES;
  } catch {
    return facultyId ? MOCK_COURSES.filter((c) => c.faculty_id === facultyId) : MOCK_COURSES;
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

export async function getFacultyById(id: string): Promise<Faculty | null> {
  if (!isSupabaseLive()) {
    return MOCK_FACULTIES.find((f) => f.id === id) ?? null;
  }
  try {
    const { data, error } = await supabase.from("faculties").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ?? MOCK_FACULTIES.find((f) => f.id === id) ?? null;
  } catch {
    return MOCK_FACULTIES.find((f) => f.id === id) ?? null;
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
  faculty_name: string;
  university_id: string;
  university_name: string;
}

export async function searchCourses(q: string): Promise<CourseSearchResult[]> {
  const term = q.trim().toLowerCase();
  if (!term) return [];

  if (!isSupabaseLive()) {
    return MOCK_COURSES.filter(
      (c) => c.name_ar.toLowerCase().includes(term) || (c.code && c.code.toLowerCase().includes(term))
    ).map((c) => {
      const fac = MOCK_FACULTIES.find((f) => f.id === c.faculty_id);
      const uni = MOCK_UNIVERSITIES.find((u) => u.id === fac?.university_id);
      return {
        ...c,
        faculty_name: fac?.name_ar ?? "",
        university_id: uni?.id ?? "",
        university_name: uni?.name_ar ?? "",
      };
    });
  }

  try {
    const { data, error } = await supabase
      .from("courses")
      .select("*, faculties:faculty_id(name_ar,university_id,universities:university_id(name_ar))")
      .or(`name_ar.ilike.%${term}%,code.ilike.%${term}%`)
      .order("name_ar", { ascending: true })
      .limit(25);
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      ...row,
      faculty_name: row.faculties?.name_ar ?? "",
      university_id: row.faculties?.university_id ?? "",
      university_name: row.faculties?.universities?.name_ar ?? "",
    }));
  } catch {
    return MOCK_COURSES.filter(
      (c) => c.name_ar.toLowerCase().includes(term) || (c.code && c.code.toLowerCase().includes(term))
    ).map((c) => {
      const fac = MOCK_FACULTIES.find((f) => f.id === c.faculty_id);
      const uni = MOCK_UNIVERSITIES.find((u) => u.id === fac?.university_id);
      return {
        ...c,
        faculty_name: fac?.name_ar ?? "",
        university_id: uni?.id ?? "",
        university_name: uni?.name_ar ?? "",
      };
    });
  }
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
    course_name: row.courses?.name_ar ?? row.course_name,
    faculty_name: row.courses?.faculties?.name_ar ?? row.faculty_name,
    university_name: row.courses?.faculties?.universities?.name_ar ?? row.university_name,
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
  facultyId?: string;
}

const DOCTOR_SELECT = `
  id, full_name, email, phone, office_location, university_id, faculty_id, courses, created_at, updated_at,
  universities:university_id ( name_ar ),
  faculties:faculty_id ( name_ar )
`;

function flattenDoctor(row: any): Doctor {
  return {
    ...row,
    university_name: row.universities?.name_ar ?? row.university_name,
    faculty_name: row.faculties?.name_ar ?? row.faculty_name,
  };
}

export async function searchDoctors(filters: DoctorFilters = {}): Promise<Doctor[]> {
  if (!isSupabaseLive()) {
    let docs = [...MOCK_DOCTORS];
    if (filters.universityId) docs = docs.filter((d) => d.university_id === filters.universityId);
    if (filters.facultyId) docs = docs.filter((d) => d.faculty_id === filters.facultyId);
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      docs = docs.filter((d) => d.full_name.toLowerCase().includes(q));
    }
    return docs;
  }
  try {
    let query = supabase.from("doctors").select(DOCTOR_SELECT).order("full_name", { ascending: true });
    if (filters.universityId) query = query.eq("university_id", filters.universityId);
    if (filters.facultyId) query = query.eq("faculty_id", filters.facultyId);
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
