import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { getDriveStorageQuota } from "@/lib/googleDrive";

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const includeQuota = new URL(req.url).searchParams.get("quota") === "1";

  const [
    { count: submissions, error: submissionsError },
    { count: doctorSubmissions, error: doctorsError },
    reportsRes,
    driveQuota,
  ] = await Promise.all([
    supabaseAdmin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("doctor_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("material_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
    includeQuota ? getDriveStorageQuota() : Promise.resolve(null),
  ]);

  if (submissionsError || doctorsError) {
    return NextResponse.json(
      { error: submissionsError?.message || doctorsError?.message || "تعذر حساب الطلبات" },
      { status: 500 }
    );
  }

  const openReports = reportsRes.error ? 0 : reportsRes.count ?? 0;

  return NextResponse.json({
    submissions: submissions ?? 0,
    doctorSubmissions: doctorSubmissions ?? 0,
    reports: openReports,
    total: (submissions ?? 0) + (doctorSubmissions ?? 0) + openReports,
    driveQuota,
  });
}
