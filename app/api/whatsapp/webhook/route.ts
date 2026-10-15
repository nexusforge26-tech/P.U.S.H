import { NextRequest, NextResponse } from "next/server";
import { searchMaterialsForWhatsAppBot } from "@/lib/whatsappBot";

export const runtime = "nodejs";

function getSiteBaseUrl(req: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * 1) التحقق من Webhook الخاص بـ Meta WhatsApp Cloud API (GET)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "push_whatsapp_verify_2026";

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ status: "PUSH WhatsApp + Gemini Webhook is active" });
}

/**
 * 2) استقبال رسائل الطلاب من WhatsApp (يدعم كلاً من Meta WhatsApp Cloud API الرسمي، أو طلبات n8n / Make / Evolution API المباشرة)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const baseUrl = getSiteBaseUrl(req);

    // الحالة أ: استدعاء مباشر من n8n أو Make.com أو أداة خارجية ({ message: "ملخص دوائر 4106" })
    if (typeof body?.message === "string" && body.message.trim()) {
      const { replyText, results } = await searchMaterialsForWhatsAppBot(body.message, baseUrl);
      return NextResponse.json({
        reply: replyText,
        results,
      });
    }

    // الحالة ب: Webhook رسمي من Meta WhatsApp Cloud API
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj || messageObj.type !== "text") {
      return NextResponse.json({ ok: true });
    }

    const fromPhone: string = messageObj.from;
    const studentText: string = messageObj.text?.body || "";
    const phoneNumberId: string =
      value?.metadata?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || "";

    if (!studentText.trim() || !fromPhone) {
      return NextResponse.json({ ok: true });
    }

    const { replyText } = await searchMaterialsForWhatsAppBot(studentText, baseUrl);

    // إرسال الرد تلقائيًا عبر Meta WhatsApp Cloud API إذا كان التوكن مضبوطًا
    const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (whatsappToken && phoneNumberId) {
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

    return NextResponse.json({ ok: true, reply: replyText });
  } catch (err: unknown) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ error: "تعذر معالجة الرسالة" }, { status: 500 });
  }
}
