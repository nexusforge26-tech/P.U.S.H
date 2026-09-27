import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

// سجل المنشورات: يظهر فقط للمسؤول والمالك (requireRole يمنع أي دور آخر).
export async function GET(req: NextRequest) {
  if (!(await requireRole(req, ["admin", "owner"]))) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  const limit = Math.min(300, Math.max(20, Number(new URL(req.url).searchParams.get("limit") ?? 150)));
  const { data, error } = await supabaseAdmin
    .from("activity_log")
    .select("id,actor_id,actor_name,actor_email,action,target_type,target_id,title_ar,course_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
