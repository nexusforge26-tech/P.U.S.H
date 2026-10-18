import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, rejectIfProfileIncomplete } from "@/lib/auth";
import { initiateDriveResumableUpload } from "@/lib/googleDrive";
import {
  MAX_PENDING_SUBMISSIONS_PER_USER,
  MAX_UPLOADS_PER_DAY,
  MAX_UPLOAD_BYTES_PER_DAY,
  validateUploadFileMeta,
} from "@/lib/uploadLimits";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { badRequest, cleanText, rateLimit, safeJson, serverError, tooManyRequests, trustedOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const account = await getRequestUser(req);
  if (!account) return NextResponse.json({ error: "يجب تسجيل الدخول أولًا" }, { status: 401 });
  const incomplete = rejectIfProfileIncomplete(account.profile);
  if (incomplete) return incomplete;

  // حماية سريعة من الإغراق قبل أي استعلام (لكل مستخدم)
  const burst = rateLimit(`upload-init:${account.user.id}`, 10, 10 * 60 * 1000);
  if (!burst.ok) return tooManyRequests(burst.retryAfterSec, "محاولات رفع كثيرة خلال وقت قصير، حاول بعد قليل.");

  try {
    const isPlainUser = account.profile.role === "user";

    // منع المستخدم الذي تجاوز حد المساهمات المعلقة من رفع ملفات إضافية تستهلك مساحة Drive
    if (isPlainUser) {
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

    const body = await safeJson<{ fileName?: unknown; mimeType?: unknown; fileSize?: unknown }>(req, 10_000);
    if (!body) return badRequest();

    const fileName = cleanText(body.fileName, 255);
    const mimeType = cleanText(body.mimeType, 150) || "application/octet-stream";
    const fileSize = Number(body.fileSize);

    const fileCheck = validateUploadFileMeta(fileName, mimeType, fileSize);
    if (!fileCheck.valid) {
      return NextResponse.json({ error: fileCheck.error || "نوع أو حجم الملف غير صالح" }, { status: 400 });
    }

    // حصة يومية لكل مستخدم عادي: كان بإمكان أي حساب بدء رفع ملفات ضخمة بلا حد (لا تظهر كمساهمات
    // قبل إتمامها) واستنزاف مساحة Drive. الجدول upload_log يُنشأ بترحيل 2026-10-18؛ إن لم يكن
    // موجودًا بعد نتجاوز هذا الفحص دون تعطيل الرفع.
    let quotaTrackingAvailable = true;
    if (isPlainUser) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent, error: quotaErr } = await supabaseAdmin
        .from("upload_log")
        .select("file_size")
        .eq("user_id", account.user.id)
        .gte("created_at", since)
        .limit(500);

      if (quotaErr) {
        quotaTrackingAvailable = false;
        console.error("[upload] upload_log unavailable:", quotaErr.message);
      } else {
        const usedCount = recent?.length ?? 0;
        const usedBytes = (recent ?? []).reduce((sum, r) => sum + Number(r.file_size ?? 0), 0);
        if (usedCount >= MAX_UPLOADS_PER_DAY || usedBytes + fileSize > MAX_UPLOAD_BYTES_PER_DAY) {
          return NextResponse.json(
            { error: "وصلت إلى الحد اليومي للرفع. يمكنك المتابعة غدًا أو التواصل مع الإدارة." },
            { status: 429 }
          );
        }
      }
    }

    const result = await initiateDriveResumableUpload(fileName, mimeType, fileSize, trustedOrigin(req));

    if (quotaTrackingAvailable) {
      await supabaseAdmin
        .from("upload_log")
        .insert({ user_id: account.user.id, file_name: fileName.slice(0, 255), file_size: Math.round(fileSize) });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    return serverError(err, "تعذر بدء الرفع إلى Google Drive");
  }
}
