import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { initiateDriveResumableUpload } from "@/lib/googleDrive";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/uploadLimits";

export const runtime = "nodejs";

// نطاق الموقع الذي سيرفع منه المتصفح (يلزم لإعداد CORS في جلسة Google).
function requestOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return null;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  try {
    const body = await req.json();
    const fileName = String(body?.fileName || "").trim().slice(0, 255);
    const mimeType = String(body?.mimeType || "application/octet-stream");
    const fileSize = Number(body?.fileSize);

    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "بيانات الملف غير صالحة" }, { status: 400 });
    }
    if (fileSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `حجم الملف أكبر من الحد المسموح به (${MAX_UPLOAD_LABEL})` }, { status: 413 });
    }

    const result = await initiateDriveResumableUpload(fileName, mimeType, fileSize, requestOrigin(req));
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("Drive upload initiation error:", err);
    return NextResponse.json({ error: err?.message || "تعذر بدء الرفع إلى Google Drive" }, { status: 500 });
  }
}
