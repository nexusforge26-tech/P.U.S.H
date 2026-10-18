import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/auth";
import type { ReportReason } from "@/lib/types";
import {
  badRequest,
  cleanText,
  getClientIp,
  hashIp,
  isUuid,
  isValidEmail,
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
    const account = await getRequestUser(req);
    const ip = getClientIp(req);

    // الإبلاغ متاح للزوار (روابط معطلة)، لذلك نقيّده بحد لكل مستخدم/عنوان لمنع إغراق لوحة الإدارة.
    const subject = account ? `u:${account.user.id}` : `ip:${ip}`;
    const limit = rateLimit(`report:${subject}`, account ? 15 : 5, 60 * 60 * 1000);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSec, "أرسلت بلاغات كثيرة، يرجى المحاولة لاحقًا.");

    const body = await safeJson<Record<string, unknown>>(req, 20_000);
    if (!body) return badRequest();

    const materialId = String(body.material_id ?? "").trim();
    const reason = String(body.reason ?? "").trim() as ReportReason;
    const details = cleanText(body.details, 1000);

    if (!isUuid(materialId) || !ALLOWED_REASONS.has(reason)) {
      return badRequest("بيانات البلاغ غير مكتملة");
    }

    // بريد المُبلِّغ: للمسجّل نستخدم بريد حسابه ولا نثق بما يرسله العميل؛ للزائر نقبل بريدًا صالحًا فقط.
    let reporterEmail: string | null = null;
    if (account?.profile.email) {
      reporterEmail = account.profile.email.slice(0, 150);
    } else {
      const provided = cleanText(body.reporter_email, 150).toLowerCase();
      if (provided) {
        if (!isValidEmail(provided)) return badRequest("صيغة البريد الإلكتروني غير صحيحة");
        reporterEmail = provided;
      }
    }

    const { data: material } = await supabaseAdmin
      .from("materials")
      .select("id")
      .eq("id", materialId)
      .maybeSingle();
    if (!material) return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });

    // منع تكرار نفس البلاغ المفتوح من نفس الحساب
    if (account) {
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
      user_id: account?.user.id ?? null,
      reporter_email: reporterEmail,
      reason,
      details: details || null,
      status: "open",
    };

    // reporter_ip_hash عمود جديد (ترحيل 2026-10-18)؛ إن لم يكن موجودًا نعيد المحاولة بدونه.
    let { error } = await supabaseAdmin
      .from("material_reports")
      .insert({ ...payload, reporter_ip_hash: account ? null : hashIp(ip) });
    if (error) {
      const retry = await supabaseAdmin.from("material_reports").insert(payload);
      error = retry.error;
    }

    if (error) return serverError(error, "تعذر إرسال البلاغ");

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return serverError(err, "تعذر إرسال البلاغ");
  }
}
