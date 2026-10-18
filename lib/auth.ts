import crypto from "crypto";
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
  /** وقت أول عرض لنافذة إكمال البيانات (تظهر مرة واحدة فقط لكل حساب). */
  profile_prompted_at: string | null;
  /** وقت تحويل المستخدم الجديد مباشرة إلى «حسابي» بعد أول تسجيل (مرة واحدة). */
  onboarding_redirected_at: string | null;
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

// ذاكرة مؤقتة قصيرة (10 ثوانٍ) لنتيجة التحقق من الجلسة: كل طلب API كان يتطلب رحلتين إلى Supabase
// (التحقق من الرمز ثم قراءة الملف الشخصي)، ولوحة الإدارة وصفحة الحساب ترسل عدة طلبات متوازية.
// مدتها قصيرة عمدًا حتى لا يتأخر أثر تغيير الدور أو إلغاء الجلسة، ونُفرغها فور حفظ الملف الشخصي أو تغيير الدور.
const ACCOUNT_CACHE_TTL_MS = 10_000;
const accountCache = new Map<string, { exp: number; userId: string; value: AccountResult }>();

export function invalidateAccountCache(userId: string) {
  for (const [k, v] of accountCache.entries()) {
    if (v.userId === userId) accountCache.delete(k);
  }
}

type AccountResult = NonNullable<Awaited<ReturnType<typeof loadAccount>>>;

export async function getRequestUser(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 4096) return null;

  const key = crypto.createHash("sha256").update(token).digest("hex");
  const hit = accountCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;

  const value = await loadAccount(token);
  if (!value) {
    accountCache.delete(key);
    return null;
  }
  accountCache.set(key, { exp: Date.now() + ACCOUNT_CACHE_TTL_MS, userId: value.user.id, value });
  if (accountCache.size > 2000) {
    const now = Date.now();
    for (const [k, v] of accountCache.entries()) if (v.exp <= now) accountCache.delete(k);
  }
  return value;
}

async function loadAccount(token: string) {
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const BASE_COLUMNS =
    "id,email,full_name,avatar_url,role,phone,whatsapp,university_id,managed_university_id,profile_prompted_at";
  type ProfileRow = Partial<UserProfile> & { id: string };
  let profile: ProfileRow | null = null;
  let hasOnboardingColumn = true;

  const primary = await supabaseAdmin
    .from("profiles")
    .select(`${BASE_COLUMNS},onboarding_redirected_at`)
    .eq("id", user.id)
    .maybeSingle();
  if (primary.error) {
    // العمود الجديد غير موجود بعد (لم يُنفَّذ الترحيل): نكمل بدونه حتى لا تتعطل الصلاحيات
    hasOnboardingColumn = false;
    const fallback = await supabaseAdmin.from("profiles").select(BASE_COLUMNS).eq("id", user.id).maybeSingle();
    profile = (fallback.data as ProfileRow | null) ?? null;
  } else {
    profile = (primary.data as ProfileRow | null) ?? null;
  }

  // مصدر الحقيقة للبريد هو حساب المصادقة (auth.users) لا نسخة الملف الشخصي.
  const resolvedEmail = user.email ?? profile?.email ?? null;
  // الترقية التلقائية إلى «مالك» تتطلب بريدًا موثّقًا فعلًا؛ وإلا يستطيع أي شخص إنشاء حساب
  // ببريد المالك (دون إثبات ملكيته) عبر مزوّد لا يتحقق من البريد والحصول على صلاحيات كاملة.
  const emailVerified = Boolean(user.email_confirmed_at || (user as { confirmed_at?: string }).confirmed_at);
  const shouldBeOwner = emailVerified && isConfiguredOwnerEmail(resolvedEmail);

  // إذا كان البريد مضبوطًا في OWNER_EMAIL ولم يكن دوره owner بعد، نرقّيه تلقائيًا.
  let role: UserRole = isUserRole(profile?.role) ? (profile?.role as UserRole) : "user";
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
      profile_prompted_at: profile?.profile_prompted_at ?? null,
      // بدون العمود (قبل الترحيل) نعتبر المستخدم «مُوجَّهًا» حتى لا يتعطل تدفق النافذة
      onboarding_redirected_at: hasOnboardingColumn
        ? profile?.onboarding_redirected_at ?? null
        : profile?.profile_prompted_at ?? new Date(0).toISOString(),
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
      error: "يجب إكمال بياناتك الشخصية أولًا (الاسم، رقم الهاتف، رقم الواتساب، الجامعة) من صفحة «حسابي».",
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
