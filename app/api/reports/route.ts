import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";
import type { ReportReason } from "@/lib/types";

const ALLOWED_REASONS = new Set<ReportReason>([
  "broken_link",
  "wrong_file",
  "copyright",
  "inappropriate",
  "other",
]);

export async function POST(req: NextRequest) {
  try {
    const account = await getRequestUser(req);
    const body = await req.json();
    const materialId = String(body?.material_id ?? "").trim();
    const reason = String(body?.reason ?? "").trim() as ReportReason;
    const details = String(body?.details ?? "").trim().slice(0, 1000);
    const reporterEmail = String(body?.reporter_email ?? account?.profile.email ?? "")
      .trim()
      .slice(0, 150);

    if (!materialId || !ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: "بيانات البلاغ غير مكتملة" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("material_reports").insert({
      material_id: materialId,
      user_id: account?.user.id ?? null,
      reporter_email: reporterEmail || null,
      reason,
      details: details || null,
      status: "open",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "تعذر إرسال البلاغ" }, { status: 500 });
  }
}
