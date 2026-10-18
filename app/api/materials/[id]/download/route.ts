import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, isUuid, rateLimit, shouldCountDownload, tooManyRequests } from "@/lib/security";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const materialId = params.id;
  if (!isUuid(materialId)) {
    return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  }

  const ip = getClientIp(req);

  // حد عام لكل عنوان حتى لا يُستعمل المسار لإغراق قاعدة البيانات بمعرّفات مختلفة
  const limit = rateLimit(`dl-count:${ip}`, 120, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  // نفس العنوان + نفس المادة: تنزيل واحد كل 15 دقيقة
  if (!shouldCountDownload(ip, materialId)) {
    return NextResponse.json({ ok: true, cached: true });
  }

  try {
    await supabaseAdmin.rpc("increment_downloads", { material_id: materialId });
  } catch {
    // تجاهل في حال فشل ثانوي
  }

  return NextResponse.json({ ok: true });
}
