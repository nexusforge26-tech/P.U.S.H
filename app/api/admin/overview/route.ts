import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { serverError } from "@/lib/security";

// ملخص «نظرة عامة» للوحة الإدارة: أرقام عامة + ما يحتاج انتباهًا + الأكثر تنزيلًا + آخر النشاط.
// مسؤول الجامعة يرى أرقام جامعته فقط؛ المسؤول والمالك يريان المنصة كلها.
export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const scope = actor.scopeUniversityId;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const head = { count: "exact", head: true } as const;

  try {
    // مواد ضمن النطاق (الربط الداخلي بالمساق لتصفية الجامعة)
    const materialsBase = () => {
      let q = supabaseAdmin.from("materials").select("id, courses!inner(university_id)", head);
      if (scope) q = q.eq("courses.university_id", scope);
      return q;
    };

    let topQuery = supabaseAdmin
      .from("materials")
      .select("id,title_ar,type,downloads_count,courses!inner(name_ar,university_id)")
      .order("downloads_count", { ascending: false })
      .limit(5);
    if (scope) topQuery = topQuery.eq("courses.university_id", scope);

    let activityQuery = supabaseAdmin
      .from("activity_log")
      .select("id,actor_name,actor_email,action,title_ar,created_at")
      .order("created_at", { ascending: false })
      .limit(8);
    if (scope) activityQuery = activityQuery.eq("university_id", scope);

    const profilesBase = () => {
      let q = supabaseAdmin.from("profiles").select("id", head);
      if (scope) q = q.eq("university_id", scope);
      return q;
    };

    const [
      materialsTotal,
      materials7d,
      unverified,
      coursesTotal,
      universitiesTotal,
      doctorsTotal,
      membersTotal,
      members7d,
      incompleteProfiles,
      downloadsRes,
      topRes,
      activityRes,
      ...roleCounts
    ] = await Promise.all([
      materialsBase(),
      materialsBase().gte("created_at", weekAgo),
      materialsBase().eq("is_verified", false),
      scope
        ? supabaseAdmin.from("courses").select("id", head).eq("university_id", scope)
        : supabaseAdmin.from("courses").select("id", head),
      supabaseAdmin.from("universities").select("id", head),
      scope
        ? supabaseAdmin.from("doctors").select("id", head).eq("university_id", scope)
        : supabaseAdmin.from("doctors").select("id", head),
      profilesBase(),
      profilesBase().gte("created_at", weekAgo),
      profilesBase().or("phone.is.null,whatsapp.is.null,university_id.is.null"),
      Promise.resolve(supabaseAdmin.rpc("sum_downloads", { p_university_id: scope ?? null })),
      topQuery,
      activityQuery,
      // توزيع الأدوار: للمسؤول العام فقط
      ...(scope
        ? []
        : (["user", "uni_admin", "admin", "owner"] as const).map((r) =>
            supabaseAdmin.from("profiles").select("id", head).eq("role", r)
          )),
    ]);

    const roles = scope
      ? null
      : {
          user: roleCounts[0]?.count ?? 0,
          uni_admin: roleCounts[1]?.count ?? 0,
          admin: roleCounts[2]?.count ?? 0,
          owner: roleCounts[3]?.count ?? 0,
        };

    const top = (topRes.data ?? []).map((m) => {
      const row = m as unknown as {
        id: string;
        title_ar: string;
        type: string;
        downloads_count: number | null;
        courses: { name_ar: string } | { name_ar: string }[] | null;
      };
      const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      return {
        id: row.id,
        title_ar: row.title_ar,
        type: row.type,
        downloads: Number(row.downloads_count ?? 0),
        course_name: course?.name_ar ?? null,
      };
    });

    return NextResponse.json({
      scoped: Boolean(scope),
      totals: {
        materials: materialsTotal.count ?? 0,
        courses: coursesTotal.count ?? 0,
        universities: scope ? 1 : universitiesTotal.count ?? 0,
        doctors: doctorsTotal.count ?? 0,
        members: membersTotal.count ?? 0,
        downloads: downloadsRes.error ? 0 : Number(downloadsRes.data ?? 0),
      },
      week: {
        materials: materials7d.count ?? 0,
        members: members7d.count ?? 0,
      },
      attention: {
        unverifiedMaterials: unverified.count ?? 0,
        incompleteProfiles: incompleteProfiles.count ?? 0,
      },
      roles,
      topMaterials: top,
      recentActivity: activityRes.data ?? [],
    });
  } catch (err) {
    return serverError(err, "تعذر تحميل ملخص اللوحة");
  }
}
