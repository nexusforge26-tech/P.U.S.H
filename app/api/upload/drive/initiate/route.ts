import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { initiateDriveResumableUpload } from "@/lib/googleDrive";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  try {
    const body = await req.json();
    const fileName = String(body?.fileName || "").trim();
    const mimeType = String(body?.mimeType || "application/octet-stream");
    const fileSize = Number(body?.fileSize);

    if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "بيانات الملف غير صالحة" }, { status: 400 });
    }

    const result = await initiateDriveResumableUpload(fileName, mimeType, fileSize);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("Drive upload initiation error:", err);
    return NextResponse.json({ error: err?.message || "تعذر بدء الرفع إلى Google Drive" }, { status: 500 });
  }
}
