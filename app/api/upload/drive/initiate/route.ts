import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { initiateDriveResumableUpload } from "@/lib/googleDrive";
import {
  MAX_PENDING_SUBMISSIONS_PER_USER,
  validateUploadFileMeta,
} from "@/lib/uploadLimits";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function requestOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (!host) return null;
  const proto =
    req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });

  try {
    // منع المستخدم الذي تجاوز حد المساهمات المعلقة من رفع ملفات إضافية تستهلك مساحة Drive
    if (account.profile.role === "user") {
      const { count: pendingCount } = await supabaseAdmin
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", account.user.id)
        .eq("status", "pending");

      if ((pendingCount ?? 0) >= MAX_PENDING_SUBMISSIONS_PER_USER) {
        return NextResponse.json(
          {
            error: `لديك ${pendingCount} مساهمات قيد المراجعة حاليًا. يرجى انتظار مراجعتها قبل رفع ملفات جديدة.`,
          },
          { status: 429 }
        );
      }
    }

    const body = await req.json();
    const fileName = String(body?.fileName || "").trim().slice(0, 255);
    const mimeType = String(body?.mimeType || "application/octet-stream");
    const fileSize = Number(body?.fileSize);

    const fileCheck = validateUploadFileMeta(fileName, mimeType, fileSize);
    if (!fileCheck.valid) {
      return NextResponse.json({ error: fileCheck.error || "نوع أو حجم الملف غير صالح" }, { status: 400 });
    }

    const result = await initiateDriveResumableUpload(
      fileName,
      mimeType,
      fileSize,
      requestOrigin(req)
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "تعذر بدء الرفع إلى Google Drive";
    console.error("Drive upload initiation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
