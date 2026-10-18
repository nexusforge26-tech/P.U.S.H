import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ensureFilePublicReader,
  extractDriveFileId,
  extractDriveFolderId,
  fetchDriveFileStream,
  getDriveFileMetadata,
  resolveFileFromDriveFolder,
} from "@/lib/googleDrive";
import { validateLink } from "@/lib/validation";
import { getClientIp, isUuid, rateLimit, shouldCountDownload, tooManyRequests } from "@/lib/security";

export const runtime = "nodejs";

const DIRECT_STREAM_LIMIT_BYTES = 20 * 1024 * 1024;

// أنواع آمنة للعرض داخل المتصفح (inline). أي نوع آخر يُنزَّل كمرفق دائمًا حتى لا يُنفَّذ كصفحة على نطاق الموقع.
const INLINE_SAFE_MIME = /^(application\/pdf|image\/(png|jpe?g|webp|gif))$/i;

function safeExtension(rawName: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(rawName);
  return m ? `.${m[1]!.toLowerCase()}` : ".pdf";
}

function hardenedHeaders(headers: Headers, inline: boolean) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  // الملفات المعروضة داخل المتصفح (PDF/صور) لا نضع عليها sandbox لأن عارض PDF في كروم يتوقف معه؛
  // يكفيها nosniff لأننا نحصر العرض المباشر بأنواع آمنة. أما المرفقات فنقيّدها بالكامل.
  if (!inline) headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id?.trim();

  // لا نقبل إلا معرّف مادة (UUID). كان المسار يقبل سابقًا أي معرّف ملف Drive خام،
  // فيجلب أي ملف يصل إليه حساب مالك الموقع ويجعله عامًا.
  if (!isUuid(id)) {
    return NextResponse.json({ error: "معرّف المادة غير صالح" }, { status: 400 });
  }

  const modeParam = new URL(req.url).searchParams.get("mode") || "download";
  const mode = ["download", "stream", "inline", "meta"].includes(modeParam) ? modeParam : "download";

  const ip = getClientIp(req);
  const limit = rateLimit(`dl-route:${ip}:${mode === "meta" ? "meta" : "file"}`, mode === "meta" ? 120 : 60, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  const { data: mat, error: matError } = await supabaseAdmin
    .from("materials")
    .select("id, title_ar, drive_link, youtube_id")
    .eq("id", id)
    .maybeSingle();

  if (matError) {
    console.error("[dl] material lookup failed:", matError.message);
    return NextResponse.json({ error: "تعذر جلب المادة" }, { status: 500 });
  }
  if (!mat) {
    return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });
  }

  const materialId: string = mat.id;
  const titleAr: string = mat.title_ar || "push-material";
  const driveLink: string | null = mat.drive_link;

  if (mode === "download" && shouldCountDownload(ip, materialId)) {
    Promise.resolve(supabaseAdmin.rpc("increment_downloads", { material_id: materialId })).catch(() => {});
  }

  if (!driveLink && mat.youtube_id && /^[\w-]{11}$/.test(mat.youtube_id)) {
    return NextResponse.redirect(`https://www.youtube.com/watch?v=${encodeURIComponent(mat.youtube_id)}`, 302);
  }

  if (!driveLink) {
    return NextResponse.json({ error: "لا يوجد ملف مرتبط بهذه المادة" }, { status: 404 });
  }

  let fileId = extractDriveFileId(driveLink);
  const folderId = !fileId ? extractDriveFolderId(driveLink) : null;
  let resolvedMeta = null;

  if (folderId) {
    resolvedMeta = await resolveFileFromDriveFolder(folderId);
    if (resolvedMeta?.id) {
      fileId = resolvedMeta.id;
      await ensureFilePublicReader(fileId);
      const directViewUrl = `https://drive.google.com/file/d/${fileId}/view`;
      Promise.resolve(
        supabaseAdmin
          .from("materials")
          .update({
            drive_link: directViewUrl,
            file_size: resolvedMeta.size ? Number(resolvedMeta.size) : undefined,
            mime_type: resolvedMeta.mimeType || undefined,
          })
          .eq("id", materialId)
      ).catch(() => {});
    }
  } else if (fileId) {
    resolvedMeta = await getDriveFileMetadata(fileId);
    if (resolvedMeta?.id) {
      await ensureFilePublicReader(fileId);
    }
  }

  if (mode === "meta") {
    const accessible = Boolean(fileId && resolvedMeta?.id);
    const isPresentation = resolvedMeta?.mimeType === "application/vnd.google-apps.presentation";
    const previewUrl = accessible
      ? isPresentation
        ? `https://docs.google.com/presentation/d/${encodeURIComponent(fileId!)}/embed`
        : `https://drive.google.com/file/d/${encodeURIComponent(fileId!)}/preview`
      : null;

    return NextResponse.json({
      fileId: accessible ? fileId : null,
      accessible,
      mimeType: resolvedMeta?.mimeType || null,
      previewUrl,
      streamUrl: accessible ? `/api/dl/${encodeURIComponent(materialId)}?mode=stream` : null,
      error: accessible ? null : "الملف المرتبط بهذه المادة غير متاح أو مقفل من المصدر الخارجي.",
    });
  }

  if (!fileId || !resolvedMeta?.id) {
    // رابط خارجي موثوق (غير Drive): نعيد التحقق منه عبر نفس قواعد الإدخال قبل التحويل.
    const external = validateLink(driveLink);
    if (external.valid && external.url && !external.isDrive) {
      return NextResponse.redirect(external.url, 302);
    }
    return NextResponse.json(
      { error: "تعذر العثور على ملف متاح للمعاينة أو التنزيل المباشر" },
      { status: 404 }
    );
  }

  const sizeBytes = Number(resolvedMeta?.size ?? 0);
  const rawName = resolvedMeta?.name || `${titleAr}.pdf`;
  const ext = safeExtension(rawName);
  const cleanTitle = titleAr
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "-")
    .trim()
    .slice(0, 120) || "push-material";
  const downloadFileName = cleanTitle.toLowerCase().endsWith(ext) ? cleanTitle : `${cleanTitle}${ext}`;

  const canStreamDirectly = sizeBytes === 0 || sizeBytes <= DIRECT_STREAM_LIMIT_BYTES;

  if (mode === "stream") {
    if (canStreamDirectly) {
      const streamRes = await fetchDriveFileStream(fileId);
      if (streamRes && streamRes.body) {
        const mimeType = resolvedMeta?.mimeType || streamRes.headers.get("content-type") || "application/octet-stream";
        const inlineAllowed = INLINE_SAFE_MIME.test(mimeType);

        const headers = new Headers();
        headers.set("Content-Type", inlineAllowed ? mimeType : "application/octet-stream");
        headers.set(
          "Content-Disposition",
          `${inlineAllowed ? "inline" : "attachment"}; filename="preview${ext}"; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`
        );
        if (sizeBytes > 0) headers.set("Content-Length", String(sizeBytes));
        headers.set("Cache-Control", "public, max-age=3600");
        hardenedHeaders(headers, inlineAllowed);

        return new NextResponse(streamRes.body, { status: 200, headers });
      }
    }
    return NextResponse.redirect(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`, 302);
  }

  if (mode === "inline") {
    return NextResponse.redirect(`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`, 302);
  }

  if (canStreamDirectly) {
    const streamRes = await fetchDriveFileStream(fileId);
    if (streamRes && streamRes.body) {
      const headers = new Headers();
      // التنزيل يكون دائمًا كمرفق بنوع عام، فلا يُعرض أي محتوى كصفحة على نطاق الموقع.
      headers.set("Content-Type", "application/octet-stream");
      headers.set(
        "Content-Disposition",
        `attachment; filename="download${ext}"; filename*=UTF-8''${encodeURIComponent(downloadFileName)}`
      );
      if (sizeBytes > 0) headers.set("Content-Length", String(sizeBytes));
      headers.set("Cache-Control", "public, max-age=3600");
      hardenedHeaders(headers, false);

      return new NextResponse(streamRes.body, { status: 200, headers });
    }
  }

  await ensureFilePublicReader(fileId);
  const directBinaryDownloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(fileId)}`;
  return NextResponse.redirect(directBinaryDownloadUrl, 302);
}
