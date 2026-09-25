export type MaterialType = "exam" | "summary" | "file" | "video";

export interface University {
  id: string;
  name_ar: string;
  created_at?: string;
}

export interface Faculty {
  id: string;
  university_id: string;
  name_ar: string;
  created_at?: string;
}

export interface Course {
  id: string;
  faculty_id: string;
  name_ar: string;
  code: string | null;
  created_at?: string;
}

export interface Material {
  id: string;
  course_id: string;
  title_ar: string;
  description_ar: string | null;
  type: MaterialType;
  academic_year: string | null;
  semester: string | null;
  drive_link: string | null;
  youtube_id: string | null;
  is_featured: boolean;
  downloads_count: number;
  created_at: string;
  // joined fields (populated via query)
  course_name?: string;
  faculty_name?: string;
  university_name?: string;
}

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  exam: "امتحانات سابقة",
  summary: "ملخصات",
  file: "ملفات ومراجع",
  video: "فيديوهات شرح",
};

export const SEMESTER_LABELS: Record<string, string> = {
  first: "الفصل الأول",
  second: "الفصل الثاني",
  summer: "الفصل الصيفي",
};
