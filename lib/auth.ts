import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type UserRole = "user" | "admin" | "owner";

export async function getRequestUser(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("id,email,full_name,avatar_url,role").eq("id", user.id).maybeSingle();
  return { user, profile: profile ?? { id: user.id, email: user.email ?? null, full_name: user.user_metadata?.full_name ?? null, avatar_url: user.user_metadata?.avatar_url ?? null, role: "user" as UserRole } };
}

export async function requireRole(req: NextRequest, roles: UserRole[]) {
  const account = await getRequestUser(req);
  if (!account || !roles.includes(account.profile.role as UserRole)) return null;
  return account;
}
