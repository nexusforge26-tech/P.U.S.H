import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";
import type { ReportReason } from "@/lib/types";
import {
  badRequest,
  cleanText,
  isUuid,
  rateLimit,
  safeJson,
  serverError,
  tooManyRequests,
} from "@/lib/security";

const ALLOWED_REASONS = new Set<ReportReason>([
  "broken_link",
  "wrong_file",
  "copyright",
  "inappropriate",
  "other",
]);

export async function POST(req: NextRequest) {
  try {
    // الإبلاغ يتطلب تسجيل الدخول (لا بلاغات مجهولة)
    const account = await getRequestUser(req);
    if (!account) {
      return NextResponse.json(
        { error: "سجّل الدخول لتتمكن من إرسال بلاغ", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    const limit = rateLimit(`report:u:${account.user.id}`, 15, 60 * 60 * 1000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "أرسلت بلاغات كثيرة، يرجى المحاولة لاحقًا.");

    const body = await safeJson<Record<string, unknown>>(req, 20_000);
    if (!body) return badRequest();

    const materialId = String(body.material_id ?? "").trim();
    const reason = String(body.reason ?? "").trim() as ReportReason;
    const details = cleanText(body.details, 1000);

    if (!isUuid(materialId) || !ALLOWED_REASONS.has(reason)) {
      return badRequest("بيانات البلاغ غير مكتملة");
    }

    // بريد المُبلِّغ من حسابه المسجّل ولا نثق بما يرسله العميل
    const reporterEmail: string | null = account.profile.email ? account.profile.email.slice(0, 150) : null;

    const { data: material } = await supabaseAdmin
      .from("materials")
      .select("id")
      .eq("id", materialId)
      .maybeSingle();
    if (!material) return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });

    // منع تكرار نفس البلاغ المفتوح من نفس الحساب
    {
      const { count } = await supabaseAdmin
        .from("material_reports")
        .select("id", { count: "exact", head: true })
        .eq("material_id", materialId)
        .eq("user_id", account.user.id)
        .eq("reason", reason)
        .eq("status", "open");
      if ((count ?? 0) > 0) return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    const payload = {
      material_id: materialId,
      user_id: account.user.id,
      reporter_email: reporterEmail,
      reason,
      details: details || null,
      status: "open",
    };

    const { error } = await supabaseAdmin.from("material_reports").insert(payload);

    if (error) return serverError(error, "تعذر إرسال البلاغ");

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return serverError(err, "تعذر إرسال البلاغ");
  }
}
