import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { getClientIp, hashIp, rateLimit, trustedOrigin } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios|node-fetch/i;
const NO_CONTENT = { status: 204, headers: { "Cache-Control": "no-store" } } as const;

// تسجيل زيارة واحدة (جلسة متصفح جديدة في اليوم)، سواء كان الزائر مسجّل الدخول أم لا.
// لا نخزّن IP ولا أي معرّف؛ فقط عدّادات يومية. لا نُظهر للعميل أي خطأ كي لا يتأثر الموقع.
export async function POST(req: NextRequest) {
  if (!trustedOrigin(req)) return new NextResponse(null, { status: 403 });
  if (BOT_UA.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, NO_CONTENT);

  // حد أعلى لكل IP (أفضل جهد، ومرتفع لأن شبكات الجامعات تشارك عنوانًا واحدًا)
  const limit = rateLimit(`visit:${hashIp(getClientIp(req))}`, 120, 10 * 60 * 1000);
  if (!limit.ok) return new NextResponse(null, NO_CONTENT);

  let isMember = false;
  try {
    isMember = Boolean(await getRequestUser(req));
  } catch {
    isMember = false;
  }

  const { error } = await supabaseAdmin.rpc("record_site_visit", { p_is_member: isMember });
  if (error) console.error("[visits] record failed:", error.code || "unknown");
  return new NextResponse(null, NO_CONTENT);
}
