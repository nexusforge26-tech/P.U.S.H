import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET(req: NextRequest) {
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const status = new URL(req.url).searchParams.get("status") ?? "open";

  try {
    let query = supabaseAdmin
      .from("material_reports")
      .select(
        "id,material_id,user_id,reporter_email,reason,details,status,resolved_by,resolved_at,created_at,materials:material_id(title_ar,drive_link,youtube_id,courses:course_id(name_ar))"
      )
      .order("created_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ reports: [] });

    const reports = (data ?? []).map((row: Record<string, unknown>) => {
      const mat = row.materials as {
        title_ar?: string;
        drive_link?: string;
        youtube_id?: string;
        courses?: { name_ar?: string };
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
  const actor = await requireRole(req, ["admin", "owner"]);
  if (!actor) return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const body = await req.json();
  const { id, status } = body as { id?: string; status?: "resolved" | "dismissed" };
  if (!id || !status || !["resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    actor,
    action: "report_resolved",
    target_type: "report",
    target_id: id,
    title_ar: status === "resolved" ? "تمت معالجة البلاغ" : "تم إغلاق البلاغ",
  });

  return NextResponse.json({ report: data });
}
