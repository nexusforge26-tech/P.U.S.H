import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isProfileComplete } from "@/lib/profile";
import { getStaffScope, isUserRole, type UserRole } from "@/lib/roles";

export type { UserRole };

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  /** رقم الهاتف بصيغة دولية (E.164) */
  phone: string | null;
  /** رقم الواتساب بصيغة دولية (E.164) */
  whatsapp: string | null;
  university_id: string | null;
  /** الجامعة التي يديرها «مسؤول الجامعة» (uni_admin) — null لبقية الأدوار. */
  managed_university_id: string | null;
  created_at?: string;
  updated_at?: string;
}

// دوال القواعد النقية (تغيير الدور/الحذف/مالك الموقع) موجودة في lib/roles.ts لتُختبر وتُستعمل في الواجهة،
// ونعيد تصديرها هنا للتوافق مع الاستيرادات القديمة.
export {
  getOwnerEmails,
  isConfiguredOwnerEmail,
  validateRoleChange,
  validateUserDeletion,
} from "@/lib/roles";
import { isConfiguredOwnerEmail } from "@/lib/roles";

export async function getRequestUser(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,avatar_url,role,phone,whatsapp,university_id,managed_university_id")
    .eq("id", user.id)
    .maybeSingle();

  const resolvedEmail = profile?.email ?? user.email ?? null;
  const shouldBeOwner = isConfiguredOwnerEmail(resolvedEmail);

  // إذا كان البريد مضبوطًا في OWNER_EMAIL ولم يكن دوره owner بعد، نرقّيه تلقائيًا.
  let role: UserRole = isUserRole(profile?.role) ? profile.role : "user";
  if (shouldBeOwner && role !== "owner") {
    role = "owner";
    await supabaseAdmin
      .from("profiles")
      .upsert({
        id: user.id,
        email: resolvedEmail?.toLowerCase() ?? null,
        full_name: profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
        avatar_url: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
        role: "owner",
        updated_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();
  }

  return {
    user,
    profile: {
      id: user.id,
      email: resolvedEmail,
      full_name: profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
      role,
      phone: profile?.phone ?? null,
      whatsapp: profile?.whatsapp ?? null,
      university_id: profile?.university_id ?? null,
      managed_university_id: role === "uni_admin" ? profile?.managed_university_id ?? null : null,
    } satisfies UserProfile,
  };
}

/**
 * حماية من جهة السيرفر: العمليات التي تتطلب حسابًا مكتملًا (إرسال مساهمات، رفع ملفات، تعديل موادي...)
 * ترفض أي حساب لم يُكمل بياناته (الاسم، الهاتف، الواتساب، الجامعة)، حتى لو تجاوز المستخدم نافذة المتصفح.
 * تُرجع null إذا كان الحساب مكتملًا، وإلا ترجع استجابة 403 جاهزة.
 */
export function rejectIfProfileIncomplete(profile: UserProfile): NextResponse | null {
  if (isProfileComplete(profile)) return null;
  return NextResponse.json(
    {
      error: "يجب إكمال بياناتك الشخصية أولًا (الاسم، رقم الهاتف، رقم الواتساب، الجامعة).",
      code: "PROFILE_INCOMPLETE",
    },
    { status: 403 }
  );
}

export async function requireRole(req: NextRequest, roles: UserRole[]) {
  const account = await getRequestUser(req);
  if (!account || !roles.includes(account.profile.role)) return null;
  return account;
}

export type RequestAccount = NonNullable<Awaited<ReturnType<typeof getRequestUser>>>;
export type StaffAccount = RequestAccount & {
  /** null = صلاحية على كل الجامعات (مالك/مسؤول عادي). وإلا الجامعة الوحيدة المسموح بها (مسؤول الجامعة). */
  scopeUniversityId: string | null;
};

/**
 * بوابة لوحة الإدارة: تقبل مسؤول الجامعة والمسؤول العادي والمالك، وتُرجع نطاق الجامعة.
 * مسؤول الجامعة غير المرتبط بجامعة يُرفض (لا نطاق = لا صلاحية).
 * المسارات التي تخص كل الجامعات فقط تستعمل requireRole(req, ["admin","owner"]) كما كانت.
 */
export async function requireStaff(req: NextRequest): Promise<StaffAccount | null> {
  const account = await getRequestUser(req);
  if (!account) return null;
  const scope = getStaffScope(account.profile);
  if (!scope.allowed) return null;
  return { ...account, scopeUniversityId: scope.universityId };
}

/** جامعة المساق (للتحقق من النطاق). */
export async function getCourseUniversityId(courseId: string | null | undefined): Promise<string | null> {
  if (!courseId) return null;
  const { data } = await supabaseAdmin.from("courses").select("university_id").eq("id", courseId).maybeSingle();
  return data?.university_id ?? null;
}

/** جامعة المادة عبر مساقها. */
export async function getMaterialUniversityId(materialId: string | null | undefined): Promise<string | null> {
  if (!materialId) return null;
  const { data } = await supabaseAdmin
    .from("materials")
    .select("courses:course_id(university_id)")
    .eq("id", materialId)
    .maybeSingle();
  const c = (data as { courses?: { university_id?: string } | { university_id?: string }[] | null } | null)?.courses;
  const one = Array.isArray(c) ? c[0] : c;
  return one?.university_id ?? null;
}

export function forbiddenOutOfScope() {
  return NextResponse.json({ error: "هذا العنصر خارج نطاق جامعتك." }, { status: 403 });
}
