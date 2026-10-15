import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) {
    return NextResponse.json({ user: null, profile: null, unreadNotifications: 0 }, { status: 401 });
  }

  let unreadNotifications = 0;
  try {
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", account.user.id)
      .eq("is_read", false);
    unreadNotifications = count ?? 0;
  } catch {
    unreadNotifications = 0;
  }

  return NextResponse.json({
    user: { id: account.user.id, email: account.user.email ?? null },
    profile: account.profile,
    unreadNotifications,
  });
}
