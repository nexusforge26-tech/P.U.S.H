import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { sanitizeFilterTerm, serverError } from "@/lib/security";

export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const actionFilter = searchParams.get("action")?.trim() ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(15, Number(searchParams.get("pageSize") ?? 30) || 30));
  const from = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from("activity_log")
    .select(
      "id,actor_id,actor_name,actor_email,action,target_type,target_id,title_ar,course_id,created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  // مسؤول الجامعة يرى سجل جامعته فقط
  if (actor.scopeUniversityId) {
    query = query.eq("university_id", actor.scopeUniversityId);
  }

  if (actionFilter) {
    query = query.eq("action", actionFilter);
  }
  if (q) {
    const safe = sanitizeFilterTerm(q, 100);
    if (safe) {
      query = query.or(
        `title_ar.ilike.%${safe}%,actor_name.ilike.%${safe}%,actor_email.ilike.%${safe}%`
      );
    }
  }

  const { data, count, error } = await query;
  if (error) return serverError(error);

  return NextResponse.json({
    items: data ?? [],
    count: count ?? 0,
    page,
    pageSize,
  });
}
