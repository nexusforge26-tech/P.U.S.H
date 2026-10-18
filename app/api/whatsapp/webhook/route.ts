import { NextRequest, NextResponse } from "next/server";
import { searchMaterialsForWhatsAppBot } from "@/lib/whatsappBot";
import { getClientIp, rateLimit, safeEqual, tooManyRequests, verifyMetaSignature } from "@/lib/security";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 100_000;
const MAX_MESSAGE_LENGTH = 300;

function getSiteBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** سر مشترك لاستدعاءات n8n/Make المباشرة (Authorization: Bearer ... أو x-bot-secret). */
function hasValidBotSecret(req: NextRequest): boolean {
  const secret = process.env.WHATSAPP_BOT_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization");
  const provided =
    (bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : "") || req.headers.get("x-bot-secret") || "";
  return provided.length > 0 && safeEqual(provided, secret);
}

/**
 * 1) التحقق من Webhook الخاص بـ Meta WhatsApp Cloud API (GET)
 * رمز التحقق إجباري من متغيرات البيئة (لا توجد قيمة افتراضية معروفة في الكود).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (verifyToken && mode === "subscribe" && token && safeEqual(token, verifyToken) && challenge) {
    // نعيد الـ challenge كنص خام فقط (أرقام) حتى لا يُستغل كانعكاس HTML.
    const safeChallenge = challenge.replace(/[^\w-]/g, "").slice(0, 200);
    return new NextResponse(safeChallenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return NextResponse.json({ status: "ok" });
}

/**
 * 2) استقبال رسائل الطلاب من WhatsApp.
 *  - Meta Cloud API: يجب أن يحمل التوقيع X-Hub-Signature-256 الصحيح (WHATSAPP_APP_SECRET).
 *  - n8n / Make: يجب أن يحمل السر WHATSAPP_BOT_SECRET.
 * أي طلب بلا توثيق يُرفض؛ كان الويب هوك مفتوحًا فيمكن استهلاك مفتاح Gemini وإرسال رسائل
 * من رقم الموقع الرسمي إلى أي رقم عبر تزوير الحقل from.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = rateLimit(`wa:${ip}`, 60, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "الطلب كبير جدًا" }, { status: 413 });
  }

  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "الطلب كبير جدًا" }, { status: 413 });
    }

    const appSecret = process.env.WHATSAPP_APP_SECRET;
    const metaSignatureOk =
      Boolean(appSecret) && verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret as string);
    const botSecretOk = hasValidBotSecret(req);

    if (!metaSignatureOk && !botSecretOk) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    let body: Record<string, any>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const baseUrl = getSiteBaseUrl(req);

    // الحالة أ: استدعاء مباشر من n8n أو Make.com ({ message: "ملخص دوائر 4106" }) — يتطلب السر المشترك
    if (botSecretOk && typeof body?.message === "string" && body.message.trim()) {
      const message = body.message.trim().slice(0, MAX_MESSAGE_LENGTH);
      const { replyText, results } = await searchMaterialsForWhatsAppBot(message, baseUrl);
      return NextResponse.json({ reply: replyText, results });
    }

    // الحالة ب: Webhook رسمي من Meta WhatsApp Cloud API — يتطلب التوقيع الصحيح
    if (!metaSignatureOk) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj || messageObj.type !== "text") {
      return NextResponse.json({ ok: true });
    }

    const fromPhone = String(messageObj.from ?? "");
    const studentText = String(messageObj.text?.body ?? "").trim().slice(0, MAX_MESSAGE_LENGTH);
    const phoneNumberId = String(value?.metadata?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || "");

    if (!studentText || !/^\d{6,20}$/.test(fromPhone) || !/^\d{5,25}$/.test(phoneNumberId)) {
      return NextResponse.json({ ok: true });
    }

    // حد لكل رقم مرسل حتى لا يستهلك شخص واحد حصة Gemini
    const perSender = rateLimit(`wa-sender:${fromPhone}`, 15, 10 * 60 * 1000);
    if (!perSender.ok) return NextResponse.json({ ok: true });

    const { replyText } = await searchMaterialsForWhatsAppBot(studentText, baseUrl);

    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (whatsappToken) {
      await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: fromPhone,
          type: "text",
          text: {
            preview_url: false,
            body: replyText,
          },
        }),
      });
    }

    // لا نُعيد نص الرد في الاستجابة لـ Meta (غير لازم).
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("WhatsApp webhook error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "تعذر معالجة الرسالة" }, { status: 500 });
  }
}
