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

export const runtime = "nodejs";

const DIRECT_STREAM_LIMIT_BYTES = 20 * 1024 * 1024;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "معرّف الملف مطلوب" }, { status: 400 });
  }

  const mode = new URL(req.url).searchParams.get("mode") || "download";

  let driveLink: string | null = null;
  let titleAr = "push-material";
  let materialId: string | null = null;

  if (/^[0-9a-fA-F-]{36}$/.test(id)) {
    const { data: mat } = await supabaseAdmin
      .from("materials")
      .select("id, title_ar, drive_link, youtube_id")
      .eq("id", id)
      .maybeSingle();

    if (!mat) {
      return NextResponse.json({ error: "المادة غير موجودة" }, { status: 404 });
    }

    materialId = mat.id;
    titleAr = mat.title_ar || titleAr;
    driveLink = mat.drive_link;

    if (mode === "download") {
      Promise.resolve(
        supabaseAdmin.rpc("increment_downloads", { material_id: mat.id })
      ).catch(() => {});
    }

    if (!driveLink && mat.youtube_id) {
      return NextResponse.redirect(`https://www.youtube.com/embed/${mat.youtube_id}`, 302);
    }
  } else {
    driveLink = `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
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
      if (materialId) {
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
    }
  }

  if (mode === "meta") {
    return NextResponse.json({
      fileId: fileId || null,
      previewUrl: fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null,
    });
  }

  if (mode === "inline" && fileId) {
    return NextResponse.redirect(
      `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`,
      302
    );
  }

  if (!fileId) {
    if (driveLink.startsWith("https://") && !driveLink.includes("/drive/folders/")) {
      return NextResponse.redirect(driveLink, 302);
    }
    return NextResponse.json(
      { error: "تعذر العثور على ملف قابل للتنزيل المباشر" },
      { status: 404 }
    );
  }

  if (!resolvedMeta) {
    resolvedMeta = await getDriveFileMetadata(fileId);
  }

  const sizeBytes = Number(resolvedMeta?.size ?? 0);
  const rawName = resolvedMeta?.name || `${titleAr}.pdf`;
  const ext = rawName.includes(".") ? "." + rawName.split(".").pop() : ".pdf";
  const cleanTitle = titleAr.replace(/[\\/:*?"<>|]/g, "-").trim();
  const downloadFileName = cleanTitle.toLowerCase().endsWith(ext.toLowerCase())
    ? cleanTitle
    : `${cleanTitle}${ext}`;

  if (sizeBytes === 0 || sizeBytes <= DIRECT_STREAM_LIMIT_BYTES) {
    const streamRes = await fetchDriveFileStream(fileId);
    if (streamRes && streamRes.body) {
      const mimeType =
        resolvedMeta?.mimeType ||
        streamRes.headers.get("content-type") ||
        "application/octet-stream";

      const headers = new Headers();
      headers.set("Content-Type", mimeType);
      headers.set(
        "Content-Disposition",
        `attachment; filename="download${ext}"; filename*=UTF-8''${encodeURIComponent(
          downloadFileName
        )}`
      );
      if (sizeBytes > 0) {
        headers.set("Content-Length", String(sizeBytes));
      }
      headers.set("Cache-Control", "public, max-age=3600");

      return new NextResponse(streamRes.body, {
        status: 200,
        headers,
      });
    }
  }

  await ensureFilePublicReader(fileId);
  const directBinaryDownloadUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(
    fileId
  )}`;
  return NextResponse.redirect(directBinaryDownloadUrl, 302);
}
