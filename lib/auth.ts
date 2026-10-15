import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UserRole = "user" | "admin" | "owner";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
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

  if (!["user", "admin", "owner"].includes(newRole)) {
    return { allowed: false, error: "الصلاحية المطلوبة غير صالحة." };
  }

  if (isConfiguredOwnerEmail(targetEmail, ownerEnv) && newRole !== "owner") {
    return { allowed: false, error: "لا يمكن خفض صلاحية مالك الموقع الأساسي." };
  }

  if (newRole === "owner" && actorRole !== "owner") {
    return { allowed: false, error: "ترقية مستخدم إلى مالك متاحة للمالك فقط." };
  }

  if (targetRole === "owner" && actorRole !== "owner") {
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

  if (targetRole === "admin" && actorRole !== "owner") {
    return { allowed: false, error: "حذف مسؤول متاح للمالك فقط." };
  }

  return { allowed: true };
}

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
    .select("id,email,full_name,avatar_url,role")
    .eq("id", user.id)
    .maybeSingle();

  const resolvedEmail = profile?.email ?? user.email ?? null;
  const shouldBeOwner = isConfiguredOwnerEmail(resolvedEmail);

  // إذا كان البريد مضبوطًا في OWNER_EMAIL ولم يكن دوره owner بعد، نرقّيه تلقائيًا.
  let role: UserRole = (profile?.role as UserRole) ?? "user";
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
    } satisfies UserProfile,
  };
}

export async function requireRole(req: NextRequest, roles: UserRole[]) {
  const account = await getRequestUser(req);
  if (!account || !roles.includes(account.profile.role)) return null;
  return account;
}
