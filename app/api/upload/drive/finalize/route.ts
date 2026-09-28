import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { finalizeDriveUpload } from "@/lib/googleDrive";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  try {
    const body = await req.json();
    const fileId = String(body?.fileId || "").trim();
    const fileName = String(body?.fileName || "الملف");
    if (!fileId) return NextResponse.json({ error: "معرّف الملف مفقود" }, { status: 400 });

    const result = await finalizeDriveUpload(fileId, fileName);
    return NextResponse.json({ drive_link: result.link, file_name: result.name, file_id: result.id }, { status: 200 });
  } catch (err: any) {
    console.error("Drive upload finalization error:", err);
    return NextResponse.json({ error: err?.message || "تعذر إنهاء رفع الملف إلى Google Drive" }, { status: 500 });
  }
}
