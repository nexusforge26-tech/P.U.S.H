import "server-only";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

// ============================================================================
// أدوات أمان مشتركة للسيرفر (تُستعمل داخل مسارات /api فقط)
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/** معرّف ملف/مجلد Google Drive: حروف وأرقام و _ و - فقط. */
export function isDriveId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{10,128}$/.test(value);
}

/**
 * ينظّف نصًا قبل وضعه داخل فلتر PostgREST (.or(...) / ilike).
 * الفواصل والأقواس والاقتباس تسمح بحقن شروط إضافية في الاستعلام،
 * و % و * محارف بحث شاملة، فنحذفها كلها ونقصّ الطول.
 */
export function sanitizeFilterTerm(raw: unknown, maxLength = 80): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[,()%*\\"'`;:{}[\]<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** عنوان IP للعميل: نفضّل ترويسات المنصة الموثوقة على X-Forwarded-For القابلة للتزوير. */
export function getClientIp(req: NextRequest): string {
  const direct =
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip");
  if (direct) return direct.split(",")[0]!.trim().slice(0, 64);
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  return "unknown";
}

/** بصمة غير قابلة للعكس لعنوان IP (لا نخزّن العنوان نفسه). */
export function hashIp(ip: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY || "push";
  return crypto.createHash("sha256").update(`${pepper}:${ip}`).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Rate limit داخل الذاكرة (أفضل جهد لكل نسخة سيرفر). للحماية الصارمة عبر عدة نسخ
// استخدم Upstash/Redis؛ وهذا يمنع الإغراق العادي والتكرار السريع.
// ---------------------------------------------------------------------------
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count += 1;
    if (entry.count > limit) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    }
  }

  if (buckets.size > 10_000) {
    for (const [k, v] of buckets.entries()) {
      if (now >= v.resetAt) buckets.delete(k);
    }
  }
  return { ok: true, retryAfterSec: 0 };
}

export function tooManyRequests(retryAfterSec: number, message = "عدد الطلبات كبير جدًا، حاول لاحقًا.") {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

/** يحدد هل نحتسب تنزيلًا جديدًا (نفس العنوان + نفس المادة مرة كل 15 دقيقة). */
export function shouldCountDownload(ip: string, materialId: string): boolean {
  return rateLimit(`dl:${ip}:${materialId}`, 1, 15 * 60 * 1000).ok;
}

// ---------------------------------------------------------------------------
// قراءة JSON بأمان: حد للحجم + عدم رمي استثناء عند JSON تالف.
// ---------------------------------------------------------------------------
export async function safeJson<T = Record<string, unknown>>(
  req: NextRequest,
  maxBytes = 100_000
): Promise<T | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch {
    return null;
  }
}

export function badRequest(message = "بيانات غير صالحة") {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** خطأ سيرفر عام: نسجّل التفاصيل في السجل الداخلي ولا نكشفها للمستخدم. */
export function serverError(err?: unknown, message = "تعذر تنفيذ العملية، حاول مرة أخرى.") {
  if (err) {
    const detail = err instanceof Error ? err.message : (err as { message?: string })?.message ?? err;
    console.error("[server-error]", detail);
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

/** مقارنة نصوص بزمن ثابت (للأسرار والتوقيعات). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** التحقق من توقيع Meta (X-Hub-Signature-256) على الجسم الخام. */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signatureHeader);
}

/** يقبل Origin فقط إذا كان يطابق الموقع نفسه (لا نمرّر Origin عشوائيًا إلى Google). */
export function trustedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  try {
    const o = new URL(origin);
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const site = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : "";
    if (o.host === host || (site && o.host === site)) return o.origin;
  } catch {
    // تجاهل
  }
  return null;
}

/** نص حر من المستخدم: يزيل محارف التحكم ويقصّ الطول. */
export function cleanText(raw: unknown, maxLength: number): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200e\u200f\u202a-\u202e]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function isValidEmail(value: string): boolean {
  return value.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}
