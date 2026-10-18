export type MaterialType = "exam" | "summary" | "file" | "video";
export type MaterialSort = "newest" | "downloads" | "helpful";

export interface University {
  id: string;
  name_ar: string;
  created_at?: string;
}

export interface Course {
  id: string;
  university_id: string;
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
  is_verified?: boolean;
  downloads_count: number;
  helpful_count?: number;
  file_size?: number | null;
  mime_type?: string | null;
  page_count?: number | null;
  created_at: string;
  created_by?: string | null;
  // الحقول المضمّنة من العلاقات (Joined fields)
  course_name?: string;
  course_code?: string | null;
  university_id?: string;
  university_name?: string;
}

export type SubmissionKind = "material" | "course" | "material_edit";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  user_id: string | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  kind: SubmissionKind;
  course_id: string | null;
  target_material_id?: string | null;
  title_ar: string;
  description_ar: string | null;
  type: MaterialType | null;
  academic_year: string | null;
  semester: string | null;
  drive_link: string | null;
  youtube_id: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  page_count?: number | null;
  suggested_course_name?: string | null;
  suggested_course_code?: string | null;
  suggested_university_id?: string | null;
  status: SubmissionStatus;
  admin_note: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  // حقول إضافية للعرض في لوحة الإدارة وحساب العضو
  email?: string;
  user_name?: string;
  course_name?: string;
  course_code?: string;
  university_name?: string;
  duplicate_warning?: boolean;
  duplicate_titles?: string[];
}

export interface LinkedCourseInfo {
  id: string;
  name_ar: string;
  code: string | null;
  university_id: string;
}

export interface Doctor {
  id: string;
  full_name: string;
  email: string;
  office_location: string | null;
  university_id: string;
  courses: string[];
  linked_courses?: LinkedCourseInfo[];
  created_at: string;
  updated_at?: string;
  university_name?: string;
}

export type DoctorSubmissionKind = "new" | "edit";

export interface DoctorSubmission {
  id: string;
  user_id: string | null;
  submitter_name?: string | null;
  submitter_email?: string | null;
  kind: DoctorSubmissionKind;
  target_doctor_id: string | null;
  full_name: string;
  email: string;
  office_location: string | null;
  university_id: string;
  courses: string[];
  course_ids?: string[];
  status: SubmissionStatus;
  admin_note: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  user_name?: string;
  submitter_account_email?: string;
  university_name?: string;
  current?: Doctor | null;
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

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export type ReportReason = "broken_link" | "wrong_file" | "copyright" | "inappropriate" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";

export interface MaterialReport {
  id: string;
  material_id: string;
  user_id: string | null;
  reporter_email?: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
  material_title?: string;
  course_name?: string;
}

export interface PlatformStats {
  materials: number;
  courses: number;
  universities: number;
  downloads: number;
}

export interface DriveQuotaInfo {
  limit: number | null;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
  percentUsed: number | null;
  isNearLimit: boolean;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  broken_link: "الرابط معطّل أو لا يعمل",
  wrong_file: "الملف خاطئ أو لا يطابق العنوان/المساق",
  copyright: "انتهاك حقوق نشر أو ملكية فكرية",
  inappropriate: "محتوى غير لائق أو مسيء",
  other: "سبب آخر",
};

export const REJECTION_REASON_PRESETS: string[] = [
  "الرابط لا يعمل أو يتطلب صلاحية وصول (يرجى جعل الرابط عامًا أو رفع الملف مباشرة)",
  "هذه المادة مكررة وموجودة مسبقًا في نفس المساق",
  "عنوان المادة أو المساق المختار غير مطابق لمحتوى الملف",
  "الملف غير واضح أو ناقص الصفحات",
  "المحتوى يخالف شروط النشر وحقوق الملكية الفكرية",
];

export const DOCTOR_REJECTION_PRESETS: string[] = [
  "الدكتور موجود بالفعل في القائمة، يرجى إرسال «تعديل دكتور موجود» بدلًا من إضافة سجل جديد",
  "البريد الإلكتروني الجامعي غير صحيح أو غير مكتمل",
  "المعلومات المدخلة غير دقيقة أو تنقصها بيانات أساسية",
];

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
  university_updated: "عدّل جامعة",
  university_deleted: "حذف جامعة",
  faculty_added: "أضاف كلية (قديم)",
  faculty_updated: "عدّل كلية (قديم)",
  faculty_deleted: "حذف كلية (قديم)",
  course_added: "أضاف مساقًا مباشرة",
  course_updated: "عدّل مساقًا",
  course_deleted: "حذف مساقًا",
  doctor_submission_created: "أرسل معلومات دكتور (بانتظار المراجعة)",
  doctor_submission_approved: "تمت الموافقة على معلومات دكتور ونشرها",
  doctor_submission_rejected: "تم رفض معلومات دكتور",
  doctor_added: "أضاف دكتورًا جديدًا",
  doctor_updated: "عدّل بيانات دكتور",
  report_resolved: "عالج بلاغًا على مادة",
  role_changed: "غيّر صلاحية حساب",
  user_deleted: "حذف حساب مستخدم",
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

export const ACADEMIC_YEAR_OPTIONS: string[] = [
  "2026/2027",
  "2025/2026",
  "2024/2025",
  "2023/2024",
  "2022/2023",
  "2021/2022",
];
