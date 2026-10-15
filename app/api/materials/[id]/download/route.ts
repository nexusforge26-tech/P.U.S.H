import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const recentDownloads = new Map<string, number>();
const COOLDOWN_MS = 15 * 60 * 1000;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const materialId = params.id;
  if (!materialId || !/^[0-9a-fA-F-]{10,}$/.test(materialId)) {
    return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]!.trim() : "anon";
  const key = `${ip}:${materialId}`;
  const now = Date.now();

  const last = recentDownloads.get(key);
  if (last && now - last < COOLDOWN_MS) {
    return NextResponse.json({ ok: true, cached: true });
  }
  recentDownloads.set(key, now);

  if (recentDownloads.size > 5000) {
    for (const [k, ts] of recentDownloads.entries()) {
      if (now - ts > COOLDOWN_MS) recentDownloads.delete(k);
    }
  }

  try {
    await supabaseAdmin.rpc("increment_downloads", { material_id: materialId });
  } catch {
    // تجاهل في حال فشل ثانوي
  }

  return NextResponse.json({ ok: true });
}
