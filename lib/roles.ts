// منطق الأدوار والتسلسل الهرمي — دوال نقية (بدون أي اعتماد على السيرفر) حتى تُستعمل في الواجهة والـ API والاختبارات.
//
//   owner      المالك: كل الصلاحيات على كل الجامعات، ولا يملك أحد صلاحية عليه.
//   admin      المسؤول العادي: كل الصلاحيات على كل الجامعات، لكن لا صلاحية له على المالك.
//   uni_admin  مسؤول (اسم الجامعة): يرى ويدير أعضاء وطلبات ومحتوى جامعته فقط، ولا يعدّل أي مسؤول آخر.
//   user       مستخدم عادي.

export type UserRole = "user" | "uni_admin" | "admin" | "owner";

export const ALL_ROLES: readonly UserRole[] = ["user", "uni_admin", "admin", "owner"];

export const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  uni_admin: 1,
  admin: 2,
  owner: 3,
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

/** أي دور يدخل لوحة الإدارة (بما فيهم مسؤول الجامعة). */
export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === "uni_admin" || role === "admin" || role === "owner";
}

/** مسؤول بصلاحية على كل الجامعات (المالك + المسؤول العادي). */
export function isGlobalStaffRole(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

export interface StaffScope {
  /** هل يملك الحساب صلاحية إدارية فعّالة؟ (مسؤول الجامعة بلا جامعة مرتبطة = لا صلاحية) */
  allowed: boolean;
  /** null = كل الجامعات. وإلا فمعرّف الجامعة الوحيدة المسموح بها. */
  universityId: string | null;
}

/**
 * يحدد نطاق الإدارة للحساب.
 * مسؤول الجامعة مقيّد دائمًا بـ managed_university_id (حقل لا يستطيع المستخدم تعديله بنفسه)،
 * وليس بـ university_id الذي يختاره الطالب في ملفه الشخصي، حتى لا يستطيع توسيع نطاقه بتغيير جامعته.
 */
export function getStaffScope(profile: {
  role: UserRole;
  managed_university_id?: string | null;
}): StaffScope {
  if (isGlobalStaffRole(profile.role)) return { allowed: true, universityId: null };
  if (profile.role === "uni_admin") {
    const id = profile.managed_university_id ?? null;
    return id ? { allowed: true, universityId: id } : { allowed: false, universityId: null };
  }
  return { allowed: false, universityId: null };
}

/** هل المورد (جامعة معيّنة) داخل نطاق الحساب؟ النطاق العام يقبل أي جامعة. */
export function isUniversityInScope(scopeUniversityId: string | null, universityId: string | null | undefined): boolean {
  if (scopeUniversityId === null) return true;
  return !!universityId && universityId === scopeUniversityId;
}

/**
 * هل يستطيع المنفِّذ تعديل/حذف حساب الهدف (الدور أو الحذف)؟
 *  - مسؤول الجامعة: لا يعدّل أحدًا (لا مسؤولًا ولا غيره).
 *  - المسؤول العادي: يعدّل الجميع عدا المالك.
 *  - المالك: يعدّل الجميع.
 */
export function canManageTarget(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "admin") return targetRole !== "owner";
  return false;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "مستخدم عادي",
  uni_admin: "مسؤول جامعة",
  admin: "مسؤول",
  owner: "مالك",
};

/** تسمية الدور مع اسم الجامعة لمسؤول الجامعة: «مسؤول (جامعة النجاح)». */
export function roleLabel(role: UserRole, universityName?: string | null): string {
  if (role === "uni_admin") return universityName ? `مسؤول (${universityName})` : ROLE_LABELS.uni_admin;
  return ROLE_LABELS[role] ?? role;
}

/**
 * يقرأ عناوين البريد الإلكتروني لمالك الموقع من متغير البيئة OWNER_EMAIL
 * (يدعم بريدًا واحدًا أو عدة عناوين مفصولة بفاصلة) بدل تثبيت البريد في الكود المصدري.
 */
export function getOwnerEmails(envValue = process.env.OWNER_EMAIL): string[] {
  if (!envValue) return [];
  return envValue
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isConfiguredOwnerEmail(email: string | null | undefined, envValue = process.env.OWNER_EMAIL): boolean {
  if (!email) return false;
  const owners = getOwnerEmails(envValue);
  return owners.includes(email.trim().toLowerCase());
}

/**
 * يتحقق من قواعد تغيير الأدوار (قابلة للاختبار بمعزل عن قاعدة البيانات).
 */
export function validateRoleChange(params: {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
  targetEmail: string | null;
  targetRole: UserRole;
  newRole: UserRole;
  ownerEnv?: string;
}): { allowed: boolean; error?: string } {
  const { actorId, actorRole, targetId, targetEmail, targetRole, newRole, ownerEnv } = params;

  if (!isUserRole(newRole)) {
    return { allowed: false, error: "الصلاحية المطلوبة غير صالحة." };
  }

  // مسؤول الجامعة لا يعدّل صلاحيات أي حساب (لا مسؤول آخر ولا عضو).
  if (actorRole === "uni_admin" || actorRole === "user") {
    return { allowed: false, error: "تعديل الصلاحيات متاح للمالك والمسؤول العادي فقط." };
  }

  if (isConfiguredOwnerEmail(targetEmail, ownerEnv) && newRole !== "owner") {
    return { allowed: false, error: "لا يمكن خفض صلاحية مالك الموقع الأساسي." };
  }

  if (newRole === "owner" && actorRole !== "owner") {
    return { allowed: false, error: "ترقية مستخدم إلى مالك متاحة للمالك فقط." };
  }

  // لا صلاحية للمسؤول العادي على المالك، بينما العكس صحيح.
  if (!canManageTarget(actorRole, targetRole)) {
    return { allowed: false, error: "لا يمكن تعديل صلاحيات المالك." };
  }

  if (targetId === actorId && newRole !== actorRole) {
    return { allowed: false, error: "لا يمكنك خفض صلاحيتك بنفسك." };
  }

  return { allowed: true };
}

/**
 * يتحقق من قواعد حذف حساب مستخدم.
 */
export function validateUserDeletion(params: {
  actorId: string;
  actorRole: UserRole;
  targetId: string;
  targetEmail: string | null;
  targetRole: UserRole;
  ownerEnv?: string;
}): { allowed: boolean; error?: string } {
  const { actorId, actorRole, targetId, targetEmail, targetRole, ownerEnv } = params;

  if (targetRole === "owner" || isConfiguredOwnerEmail(targetEmail, ownerEnv)) {
    return { allowed: false, error: "لا يمكن حذف مالك الموقع." };
  }

  if (targetId === actorId) {
    return { allowed: false, error: "لا يمكنك حذف حسابك بنفسك." };
  }

  // مسؤول الجامعة لا يحذف أي حساب.
  if (actorRole === "uni_admin" || actorRole === "user") {
    return { allowed: false, error: "حذف الحسابات متاح للمالك والمسؤول العادي فقط." };
  }

  if ((targetRole === "admin" || targetRole === "uni_admin") && actorRole !== "owner") {
    return { allowed: false, error: "حذف مسؤول متاح للمالك فقط." };
  }

  return { allowed: true };
}

