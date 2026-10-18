import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, rejectIfProfileIncomplete } from "@/lib/auth";
import { finalizeDriveUpload } from "@/lib/googleDrive";
import { badRequest, cleanText, isDriveId, rateLimit, safeJson, tooManyRequests } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const incomplete = rejectIfProfileIncomplete(account.profile);
  if (incomplete) return incomplete;

  const limit = rateLimit(`upload-finalize:${account.user.id}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const body = await safeJson<{ fileId?: unknown; fileName?: unknown }>(req, 10_000);
    if (!body) return badRequest();

    const fileId = typeof body.fileId === "string" ? body.fileId.trim() : "";
    const fileName = cleanText(body.fileName, 255) || "الملف";
    if (!isDriveId(fileId)) return badRequest("معرّف الملف مفقود أو غير صالح");

    const result = await finalizeDriveUpload(fileId, fileName);
    return NextResponse.json(
      {
        drive_link: result.link,
        file_name: result.name,
        file_id: result.id,
        file_size: result.size,
        mime_type: result.mimeType,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    // رسائل finalizeDriveUpload مكتوبة للمستخدم (لا تحتوي أسرارًا) فنعرضها كما هي.
    const message = err instanceof Error ? err.message : "تعذر إنهاء رفع الملف إلى Google Drive";
    console.error("Drive upload finalization error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
