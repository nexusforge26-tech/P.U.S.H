import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const [{ count: submissions, error: submissionsError }, { count: doctorSubmissions, error: doctorsError }] =
    await Promise.all([
      supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("doctor_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

  if (submissionsError || doctorsError) {
    return NextResponse.json({ error: submissionsError?.message || doctorsError?.message || "تعذر حساب الطلبات" }, { status: 500 });
  }

  return NextResponse.json({
    submissions: submissions ?? 0,
    doctorSubmissions: doctorSubmissions ?? 0,
    total: (submissions ?? 0) + (doctorSubmissions ?? 0),
  });
}
