import { NextRequest, NextResponse } from "next/server";
import palestineAdmin0 from "@/data/geofences/pse-admin0-ocha.json";
import { getRequestUser } from "@/lib/auth";
import { createMemberLocationRecord } from "@/lib/geofence.mjs";
import { rateLimit, safeJson, tooManyRequests, trustedOrigin } from "@/lib/security";
import { supabaseAdmin } from "@/lib/supabase/admin";

type GeoGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };
type LocationPayload = {
  latitude?: unknown;
  longitude?: unknown;
  accuracy_m?: unknown;
};

const geometry = palestineAdmin0.features[0]?.geometry as GeoGeometry;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) {
    return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  }
  if (account.profile.role !== "user") {
    return NextResponse.json({ error: "فحص الموقع مخصص لحسابات الأعضاء" }, { status: 403 });
  }
  if (!trustedOrigin(req)) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق" }, { status: 403 });
  }

  const limit = rateLimit(`member-location:${account.user.id}`, 1, 5_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const body = await safeJson<LocationPayload>(req, 1_000);
  if (!body) return NextResponse.json({ error: "بيانات الموقع غير صالحة" }, { status: 400 });

  const { latitude, longitude, accuracy_m } = body;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof accuracy_m !== "number" ||
    !Number.isFinite(accuracy_m) ||
    accuracy_m < 0 ||
    accuracy_m > 1_000_000
  ) {
    return NextResponse.json({ error: "إحداثيات الموقع أو دقته غير صالحة" }, { status: 400 });
  }

  const checkedAt = new Date().toISOString();
  const record = createMemberLocationRecord(
    account.user.id,
    latitude,
    longitude,
    accuracy_m,
    geometry,
    checkedAt
  );

  // سجل واحد لكل عضو؛ لا نسجّل الإحداثيات في logs أو في سجل تاريخي منفصل.
  const { error } = await supabaseAdmin
    .from("member_location_checks")
    .upsert(record, { onConflict: "user_id" });
  if (error) {
    console.error("[member-location-check] database write failed", error.code || "unknown");
    return NextResponse.json(
      { error: "تعذر حفظ نتيجة فحص الموقع." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  return NextResponse.json(
    { status: record.status, checked_at: checkedAt },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
