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
  created_by?: string | null;
  // joined fields (populated via query)
  course_name?: string;
  course_code?: string | null;
  faculty_name?: string;
  university_name?: string;
}

export type SubmissionKind = "material" | "course";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  user_id: string;
  kind: SubmissionKind;
  course_id: string | null;
  title_ar: string;
  description_ar: string | null;
  type: MaterialType | null;
  academic_year: string | null;
  semester: string | null;
  drive_link: string | null;
  youtube_id: string | null;
  suggested_course_name?: string | null;
  suggested_course_code?: string | null;
  suggested_faculty_id?: string | null;
  status: SubmissionStatus;
  admin_note: string | null;
  created_at: string;
}

export interface Doctor {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  office_location: string | null;
  university_id: string;
  faculty_id: string;
  courses: string[];
  created_at: string;
  updated_at?: string;
  // joined fields (populated via query)
  university_name?: string;
  faculty_name?: string;
}

export type DoctorSubmissionKind = "new" | "edit";

export interface DoctorSubmission {
  id: string;
  user_id: string;
  kind: DoctorSubmissionKind;
  target_doctor_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  office_location: string | null;
  university_id: string;
  faculty_id: string;
  courses: string[];
  status: SubmissionStatus;
  admin_note: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  title_ar: string | null;
  course_id: string | null;
  created_at: string;
}

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  material_added: "أضاف مادة مباشرة",
  material_updated: "عدّل مادة",
  material_deleted: "حذف مادة",
  material_edited_by_owner: "عدّل مادته المنشورة",
  material_deleted_by_owner: "حذف مادته المنشورة",
  submission_created: "أرسل مساهمة (بانتظار المراجعة)",
  submission_approved: "تمت الموافقة على مساهمة ونشرها",
  submission_rejected: "تم رفض مساهمة",
  course_suggestion_approved: "تمت الموافقة على مساق مقترح وإضافته",
  university_added: "أضاف جامعة",
  faculty_added: "أضاف كلية",
  course_added: "أضاف مساقًا مباشرة",
  university_updated: "عدّل اسم جامعة",
  faculty_updated: "عدّل اسم كلية",
  course_updated: "عدّل مساقًا",
  university_deleted: "حذف جامعة",
  faculty_deleted: "حذف كلية",
  course_deleted: "حذف مساقًا",
  user_role_changed: "غيّر صلاحية عضو",
  user_suspended: "أوقف حساب عضو",
  user_unsuspended: "أعاد تفعيل حساب عضو",
  user_deleted: "حذف حساب عضو",
  doctor_submission_created: "أرسل معلومات دكتور (بانتظار المراجعة)",
  doctor_submission_approved: "تمت الموافقة على معلومات دكتور ونشرها",
  doctor_submission_rejected: "تم رفض معلومات دكتور",
  doctor_added: "أضاف دكتورًا جديدًا",
  doctor_updated: "عدّل بيانات دكتور",
};

// نافذة السماح لصاحب المادة بتعديل/حذف ما نشره بنفسه، بالساعات.
export const SELF_EDIT_WINDOW_HOURS = 6;

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
