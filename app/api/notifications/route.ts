import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  try {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("id,user_id,title,message,link,is_read,created_at")
      .eq("user_id", account.user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) return NextResponse.json({ notifications: [], unreadCount: 0 });
    const notifications = data ?? [];
    const unreadCount = notifications.filter((n) => !n.is_read).length;
    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}

export async function PATCH(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id as string | undefined;
    let query = supabaseAdmin.from("notifications").update({ is_read: true }).eq("user_id", account.user.id);
    if (id) query = query.eq("id", id);
    else query = query.eq("is_read", false);
    await query;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
