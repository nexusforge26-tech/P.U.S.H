import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { getDriveStorageQuota } from "@/lib/googleDrive";
import { serverError } from "@/lib/security";

type CourseJoin = { university_id?: string } | { university_id?: string }[] | null;

function courseUniversity(row: { courses?: CourseJoin }): string | null {
  const c = row.courses;
  const one = Array.isArray(c) ? c[0] : c;
  return one?.university_id ?? null;
}

export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const scope = actor.scopeUniversityId;
  // مساحة Drive مشتركة للموقع كله: تظهر للمالك والمسؤول العادي فقط
  const includeQuota = !scope && new URL(req.url).searchParams.get("quota") === "1";

  let submissions = 0;
  let doctorSubmissions = 0;
  let openReports = 0;
  let driveQuota = null;

  if (!scope) {
    const [subsRes, docsRes, reportsRes, quota] = await Promise.all([
      supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("doctor_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("material_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
      includeQuota ? getDriveStorageQuota() : Promise.resolve(null),
    ]);
    if (subsRes.error || docsRes.error) {
      return serverError(subsRes.error || docsRes.error, "تعذر حساب الطلبات");
    }
    submissions = subsRes.count ?? 0;
    doctorSubmissions = docsRes.count ?? 0;
    openReports = reportsRes.error ? 0 : reportsRes.count ?? 0;
    driveQuota = quota;
  } else {
    // مسؤول الجامعة: نعدّ طلبات جامعته فقط
    const [subsRes, docsRes, reportsRes] = await Promise.all([
      supabaseAdmin
        .from("submissions")
        .select("id,kind,suggested_university_id,courses:course_id(university_id)")
        .eq("status", "pending"),
      supabaseAdmin
        .from("doctor_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("university_id", scope),
      supabaseAdmin
        .from("material_reports")
        .select("id,materials:material_id(courses:course_id(university_id))")
        .eq("status", "open"),
    ]);
    if (subsRes.error || docsRes.error) {
      return serverError(subsRes.error || docsRes.error, "تعذر حساب الطلبات");
    }

    submissions = (subsRes.data ?? []).filter((r) => {
      const row = r as unknown as { kind: string; suggested_university_id: string | null; courses?: CourseJoin };
      const uni = row.kind === "course" ? row.suggested_university_id : courseUniversity(row);
      return uni === scope;
    }).length;
    doctorSubmissions = docsRes.count ?? 0;
    openReports = reportsRes.error
      ? 0
      : (reportsRes.data ?? []).filter((r) => {
          const m = (r as unknown as { materials?: { courses?: CourseJoin } | { courses?: CourseJoin }[] | null })
            .materials;
          const mat = Array.isArray(m) ? m[0] : m;
          return courseUniversity({ courses: mat?.courses ?? null }) === scope;
        }).length;
  }

  return NextResponse.json({
    submissions,
    doctorSubmissions,
    reports: openReports,
    total: submissions + doctorSubmissions + openReports,
    driveQuota,
  });
}
