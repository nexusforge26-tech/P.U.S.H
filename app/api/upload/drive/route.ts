import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";

// هذا المسار لم يعد يستقبل بيانات الملفات؛ الرفع الجديد يبدأ من /initiate
// ثم تنتقل بايتات الملف مباشرة إلى جلسة Google Drive القابلة للاستئناف.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await getRequestUser(req);
  return NextResponse.json(
    { error: "تم تغيير نظام رفع الملفات. استخدم مسار الرفع الجديد." },
    { status: 410 },
  );
}
