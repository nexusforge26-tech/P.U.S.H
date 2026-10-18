import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireStaff, getMaterialUniversityId, forbiddenOutOfScope } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { badRequest, isUuid, safeJson, serverError } from "@/lib/security";

export async function GET(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const rawStatus = new URL(req.url).searchParams.get("status") ?? "open";
  const status = ["open", "resolved", "dismissed", "all"].includes(rawStatus) ? rawStatus : "open";

  try {
    let query = supabaseAdmin
      .from("material_reports")
      .select(
        "id,material_id,user_id,reporter_email,reason,details,status,resolved_by,resolved_at,created_at,materials:material_id(title_ar,drive_link,youtube_id,courses:course_id(name_ar,university_id))"
      )
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ reports: [] });

    // مسؤول الجامعة: بلاغات مواد جامعته فقط
    const visible = actor.scopeUniversityId
      ? (data ?? []).filter((row: Record<string, unknown>) => {
          const m = row.materials as { courses?: { university_id?: string } } | null;
          return m?.courses?.university_id === actor.scopeUniversityId;
        })
      : data ?? [];

    const reports = visible.map((row: Record<string, unknown>) => {
      const mat = row.materials as {
        title_ar?: string;
        drive_link?: string;
        youtube_id?: string;
        courses?: { name_ar?: string; university_id?: string };
      } | null;
      return {
        ...row,
        material_title: mat?.title_ar ?? "مادة محذوفة",
        course_name: mat?.courses?.name_ar ?? "",
      };
    });

    return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ reports: [] });
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireStaff(req);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await safeJson<{ id?: unknown; status?: unknown }>(req, 10_000);
  if (!body) return badRequest();
  const id = body.id;
  const status = body.status as "resolved" | "dismissed";
  if (!isUuid(id) || !["resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  if (actor.scopeUniversityId) {
    const { data: rep } = await supabaseAdmin
      .from("material_reports")
      .select("material_id")
      .eq("id", id)
      .maybeSingle();
    if (!rep) return NextResponse.json({ error: "البلاغ غير موجود" }, { status: 404 });
    const uni = await getMaterialUniversityId(rep.material_id);
    if (uni !== actor.scopeUniversityId) return forbiddenOutOfScope();
  }

  const { data, error } = await supabaseAdmin
    .from("material_reports")
    .update({
      status,
      resolved_by: actor.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return serverError(error);

  await logActivity({
    actor,
    action: "report_resolved",
    target_type: "report",
    target_id: id,
    title_ar: status === "resolved" ? "تمت معالجة البلاغ" : "تم إغلاق البلاغ",
  });

  return NextResponse.json({ report: data });
}
