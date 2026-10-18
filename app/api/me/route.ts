import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) {
    return NextResponse.json({ user: null, profile: null, unreadNotifications: 0 }, { status: 401 });
  }

  // الاستعلامان مستقلان: ننفذهما بالتوازي بدل التتابع
  const managedId =
    account.profile.role === "uni_admin" ? account.profile.managed_university_id : null;

  const [notifRes, uniRes] = await Promise.all([
    Promise.resolve(
      supabaseAdmin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", account.user.id)
        .eq("is_read", false)
    ).catch(() => null),
    managedId
      ? Promise.resolve(
          supabaseAdmin.from("universities").select("name_ar").eq("id", managedId).maybeSingle()
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  const unreadNotifications = notifRes?.count ?? 0;
  const managedUniversityName: string | null = uniRes?.data?.name_ar ?? null;

  return NextResponse.json({
    managedUniversityName,
    user: { id: account.user.id, email: account.user.email ?? null },
    profile: account.profile,
    unreadNotifications,
  });
}
