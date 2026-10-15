import { supabase } from "@/lib/supabase/client";
import type {
  Course,
  Doctor,
  Material,
  MaterialSort,
  MaterialType,
  PlatformStats,
  University,
} from "@/lib/types";
import {
  MOCK_UNIVERSITIES,
  MOCK_COURSES,
  MOCK_MATERIALS,
  MOCK_DOCTORS,
} from "./mockData";
import { buildArabicSearchVariants, matchesArabicSearch } from "./arabic";

export const isSupabaseLive = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes("xxxxxxxxxxxx") && url.startsWith("https://"));
};

/**
 * البيانات الوهمية (MOCK_*) تتفعّل فقط في بيئة التطوير المحلي عندما لا يكون Supabase مضبوطًا،
 * أو عند تفعيل متغير NEXT_PUBLIC_USE_MOCK_DATA=true صراحةً.
 * في بيئة الإنتاج لا نُرجع بيانات وهمية أبدًا ولا نبتلع أخطاء الاتصال.
 */
export const isMockMode = (): boolean => {
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true") return true;
  return process.env.NODE_ENV === "development" && !isSupabaseLive();
};

export async function getUniversities(): Promise<University[]> {
  if (isMockMode()) return MOCK_UNIVERSITIES;
  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }
  const { data, error } = await supabase
    .from("universities")
    .select("*")
    .order("name_ar", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCourses(universityId?: string): Promise<Course[]> {
  const mock = () =>
    universityId ? MOCK_COURSES.filter((c) => c.university_id === universityId) : MOCK_COURSES;
  if (isMockMode()) return mock();
  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }
  let query = supabase.from("courses").select("*").order("name_ar", { ascending: true });
  if (universityId) query = query.eq("university_id", universityId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getUniversityById(id: string): Promise<University | null> {
  if (isMockMode()) {
    return MOCK_UNIVERSITIES.find((u) => u.id === id) ?? null;
  }
  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }
  const { data, error } = await supabase.from("universities").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getCourseById(id: string): Promise<Course | null> {
  if (isMockMode()) {
    return MOCK_COURSES.find((c) => c.id === id) ?? null;
  }
  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }
  const { data, error } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export interface CourseSearchResult extends Course {
  university_name: string;
}

export async function searchCourses(q: string, universityId?: string): Promise<CourseSearchResult[]> {
  const term = q.trim();
  if (!term) return [];

  const fromMock = () =>
    MOCK_COURSES.filter(
      (c) =>
        (!universityId || c.university_id === universityId) &&
        (matchesArabicSearch(c.name_ar, term) || matchesArabicSearch(c.code, term))
    ).map((c) => ({
      ...c,
      university_name: MOCK_UNIVERSITIES.find((u) => u.id === c.university_id)?.name_ar ?? "",
    }));

  if (isMockMode()) return fromMock();
  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }

  const variants = buildArabicSearchVariants(term);
  if (variants.length === 0) return [];

  const orClauses = variants.flatMap((v) => [`name_ar.ilike.%${v}%`, `code.ilike.%${v}%`]).join(",");
  let query = supabase
    .from("courses")
    .select("*, universities:university_id(name_ar)")
    .or(orClauses)
    .order("name_ar", { ascending: true })
    .limit(25);
  if (universityId) query = query.eq("university_id", universityId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => {
    const uni = row.universities as { name_ar?: string } | null;
    return {
      ...(row as unknown as Course),
      university_name: uni?.name_ar ?? "",
    };
  });
}

export interface MaterialFilters {
  q?: string;
  universityId?: string;
  courseId?: string;
  type?: MaterialType;
  semester?: string;
  academicYear?: string;
  sort?: MaterialSort;
  page?: number;
  pageSize?: number;
}

const MATERIAL_SELECT = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, is_verified, downloads_count, helpful_count,
  file_size, mime_type, page_count, created_at,
  courses:course_id!inner (
    name_ar, code, university_id,
    universities:university_id ( name_ar )
  )
`;

const MATERIAL_SELECT_FALLBACK = `
  id, course_id, title_ar, description_ar, type, academic_year, semester,
  drive_link, youtube_id, is_featured, downloads_count, created_at,
  courses:course_id!inner (
    name_ar, code, university_id,
    universities:university_id ( name_ar )
  )
`;

function flattenMaterial(row: Record<string, unknown>): Material {
  const course = row.courses as {
    name_ar?: string;
    code?: string | null;
    university_id?: string;
    universities?: { name_ar?: string } | null;
  } | null;
  return {
    ...(row as unknown as Material),
    course_name: course?.name_ar ?? (row.course_name as string | undefined),
    course_code: course?.code ?? (row.course_code as string | null | undefined),
    university_id: course?.university_id ?? (row.university_id as string | undefined),
    university_name: course?.universities?.name_ar ?? (row.university_name as string | undefined),
  };
}

export async function getFeaturedMaterials(limit = 10): Promise<Material[]> {
  if (isMockMode()) {
    return MOCK_MATERIALS.filter((m) => m.is_featured).slice(0, limit);
  }
  if (!isSupabaseLive()) return [];

  const { data, error } = await supabase
    .from("materials")
    .select(MATERIAL_SELECT_FALLBACK)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => flattenMaterial(r as Record<string, unknown>));
}

export async function getRecentMaterials(limit = 8): Promise<Material[]> {
  if (isMockMode()) {
    return MOCK_MATERIALS.slice(0, limit);
  }
  if (!isSupabaseLive()) return [];

  const { data, error } = await supabase
    .from("materials")
    .select(MATERIAL_SELECT_FALLBACK)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => flattenMaterial(r as Record<string, unknown>));
}

export async function getPlatformStats(): Promise<PlatformStats> {
  if (isMockMode()) {
    const downloads = MOCK_MATERIALS.reduce((sum, m) => sum + (m.downloads_count || 0), 0);
    return {
      materials: MOCK_MATERIALS.length,
      courses: MOCK_COURSES.length,
      universities: MOCK_UNIVERSITIES.length,
      downloads,
    };
  }
  if (!isSupabaseLive()) {
    return { materials: 0, courses: 0, universities: 0, downloads: 0 };
  }

  const [matRes, crsRes, uniRes, dlRes] = await Promise.all([
    supabase.from("materials").select("id", { count: "exact", head: true }),
    supabase.from("courses").select("id", { count: "exact", head: true }),
    supabase.from("universities").select("id", { count: "exact", head: true }),
    supabase.from("materials").select("downloads_count"),
  ]);

  const downloads = (dlRes.data ?? []).reduce(
    (sum, item: { downloads_count: number | null }) => sum + Number(item.downloads_count ?? 0),
    0
  );

  return {
    materials: matRes.count ?? 0,
    courses: crsRes.count ?? 0,
    universities: uniRes.count ?? 0,
    downloads,
  };
}

export async function searchMaterials(
  filters: MaterialFilters = {}
): Promise<{ items: Material[]; count: number }> {
  const sort: MaterialSort = filters.sort ?? "newest";

  if (isMockMode()) {
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
      const q = filters.q.trim();
      items = items.filter(
        (m) =>
          matchesArabicSearch(m.title_ar, q) ||
          matchesArabicSearch(m.description_ar, q) ||
          matchesArabicSearch(m.course_name, q) ||
          matchesArabicSearch(m.course_code, q)
      );
    }

    if (sort === "downloads") {
      items.sort((a, b) => (b.downloads_count || 0) - (a.downloads_count || 0));
    } else if (sort === "helpful") {
      items.sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0));
    } else {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 12;
    const from = (page - 1) * pageSize;
    return { items: items.slice(from, from + pageSize), count: items.length };
  }

  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }

  // عند البحث النصي، نبحث في العنوان والوصف وأيضًا في اسم المساق ورمزه (مع تطبيع الحروف العربية).
  let matchingCourseIds: string[] = [];
  const rawQuery = filters.q?.trim() ?? "";
  const variants = buildArabicSearchVariants(rawQuery);

  if (variants.length > 0) {
    const courseOr = variants.flatMap((v) => [`name_ar.ilike.%${v}%`, `code.ilike.%${v}%`]).join(",");
    const { data: matchedCourses } = await supabase.from("courses").select("id").or(courseOr).limit(100);
    matchingCourseIds = (matchedCourses ?? []).map((c: { id: string }) => c.id);
  }

  const runQuery = async (selectStr: string, orderByHelpfulFallback = false) => {
    let query = supabase.from("materials").select(selectStr, { count: "exact" });
    if (filters.courseId) query = query.eq("course_id", filters.courseId);
    if (filters.universityId) query = query.eq("courses.university_id", filters.universityId);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.semester) query = query.eq("semester", filters.semester);
    if (filters.academicYear) query = query.eq("academic_year", filters.academicYear);

    if (variants.length > 0) {
      const textClauses = variants.flatMap((v) => [
        `title_ar.ilike.%${v}%`,
        `description_ar.ilike.%${v}%`,
      ]);
      if (matchingCourseIds.length > 0) {
        textClauses.push(`course_id.in.(${matchingCourseIds.join(",")})`);
      }
      query = query.or(textClauses.join(","));
    }

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 12;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    if (sort === "downloads") {
      query = query.order("downloads_count", { ascending: false }).order("created_at", { ascending: false });
    } else if (sort === "helpful" && !orderByHelpfulFallback) {
      query = query.order("helpful_count", { ascending: false }).order("downloads_count", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    return query.range(from, to);
  };

  let { data, count, error } = await runQuery(MATERIAL_SELECT);
  if (error) {
    // في حال لم يتم تطبيق ترحيل الأعمدة الجديدة بعد، نستخدم الاستعلام الأساسي
    const fallback = await runQuery(MATERIAL_SELECT_FALLBACK, true);
    if (fallback.error) throw fallback.error;
    data = fallback.data;
    count = fallback.count;
  }

  return {
    items: (data ?? []).map((r) => flattenMaterial(r as unknown as Record<string, unknown>)),
    count: count ?? 0,
  };
}

export async function getMaterialById(id: string): Promise<Material | null> {
  if (isMockMode()) {
    return MOCK_MATERIALS.find((m) => m.id === id) ?? null;
  }
  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }

  let { data, error } = await supabase.from("materials").select(MATERIAL_SELECT).eq("id", id).maybeSingle();
  if (error) {
    const fallback = await supabase
      .from("materials")
      .select(MATERIAL_SELECT_FALLBACK)
      .eq("id", id)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    data = fallback.data as unknown as typeof data;
  }
  return data ? flattenMaterial(data as unknown as Record<string, unknown>) : null;
}

export async function incrementDownloads(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    // نمنع تكرار احتساب التحميل لنفس المادة في نفس جلسة المتصفح
    const key = `push_dl_${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    await fetch(`/api/materials/${encodeURIComponent(id)}/download`, { method: "POST" });
  } catch {
    // تجاهل أخطاء الشبكة الثانوية
  }
}

export interface DoctorFilters {
  q?: string;
  universityId?: string;
  courseName?: string;
}

const DOCTOR_SELECT = `
  id, full_name, email, phone, office_location, university_id, courses, created_at, updated_at,
  universities:university_id ( name_ar )
`;

function flattenDoctor(row: Record<string, unknown>): Doctor {
  const uni = row.universities as { name_ar?: string } | null;
  return {
    ...(row as unknown as Doctor),
    university_name: uni?.name_ar ?? (row.university_name as string | undefined),
  };
}

export async function searchDoctors(filters: DoctorFilters = {}): Promise<Doctor[]> {
  if (isMockMode()) {
    let docs = [...MOCK_DOCTORS];
    if (filters.universityId) docs = docs.filter((d) => d.university_id === filters.universityId);
    if (filters.q?.trim()) {
      const q = filters.q.trim();
      docs = docs.filter(
        (d) =>
          matchesArabicSearch(d.full_name, q) ||
          d.courses.some((c) => matchesArabicSearch(c, q))
      );
    }
    return docs;
  }

  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }

  let query = supabase.from("doctors").select(DOCTOR_SELECT).order("full_name", { ascending: true });
  if (filters.universityId) query = query.eq("university_id", filters.universityId);

  const { data, error } = await query;
  if (error) throw error;

  let docs = (data ?? []).map((r) => flattenDoctor(r as unknown as Record<string, unknown>));

  // البحث يشمل اسم الدكتور وأيضًا أسماء المساقات التي يدرّسها (مع تطبيع النص العربي)
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    docs = docs.filter(
      (d) =>
        matchesArabicSearch(d.full_name, q) ||
        matchesArabicSearch(d.email, q) ||
        (d.courses ?? []).some((c) => matchesArabicSearch(c, q))
    );
  }

  return docs;
}

export async function getDoctorsByCourse(universityId: string, courseName: string): Promise<Doctor[]> {
  try {
    const docs = await searchDoctors({ universityId });
    return docs.filter((d) =>
      (d.courses ?? []).some(
        (c) => matchesArabicSearch(c, courseName) || matchesArabicSearch(courseName, c)
      )
    );
  } catch {
    return [];
  }
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  if (isMockMode()) {
    return MOCK_DOCTORS.find((d) => d.id === id) ?? null;
  }
  if (!isSupabaseLive()) {
    throw new Error("لم يتم ضبط اتصال قاعدة البيانات (Supabase)");
  }
  const { data, error } = await supabase.from("doctors").select(DOCTOR_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? flattenDoctor(data as unknown as Record<string, unknown>) : null;
}
