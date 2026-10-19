import "server-only";
import crypto from "crypto";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  validateUploadFileMeta,
} from "@/lib/uploadLimits";
import { extractDriveFileId, extractDriveFolderId } from "@/lib/validation";
import type { DriveQuotaInfo } from "@/lib/types";

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export async function getDriveAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }).toString(),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Drive OAuth refresh failed:", res.status, errText);
      throw new Error(`تعذر تجديد رمز OAuth لحساب Google Drive (${res.status})`);
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      throw new Error("لم يُرجع Google OAuth رمز وصول صالحًا");
    }

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3500) * 1000,
    };
    return data.access_token;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("لم يتم ضبط حساب Google Drive في متغيرات البيئة");
  }

  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSec + 3600,
      iat: nowSec,
    })
  );

  const signingInput = `${header}.${claimSet}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = base64UrlEncode(signer.sign(privateKey));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("Drive service-account auth failed:", res.status, errText);
    throw new Error(`تعذر مصادقة حساب خدمة Google Drive (${res.status})`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error("تعذر الحصول على رمز Google Drive");
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3500) * 1000,
  };
  return data.access_token;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  link: string;
  size: number | null;
  mimeType: string | null;
}

export interface DriveFileMetadata {
  id: string;
  name?: string;
  mimeType?: string;
  parents?: string[];
  webViewLink?: string;
  size?: string;
}

/**
 * يستعلم عن بيانات ملف في Google Drive عبر معرّفه.
 */
// كاش قصير لبيانات الملف: كل معاينة/تنزيل كان يستدعي Drive API من جديد (مئات الملّي ثانية لكل طلب).
const metadataCache = new Map<string, { exp: number; value: DriveFileMetadata }>();
const folderCache = new Map<string, { exp: number; value: DriveFileMetadata }>();
const METADATA_TTL_MS = 10 * 60 * 1000;

function cacheGet(map: Map<string, { exp: number; value: DriveFileMetadata }>, key: string) {
  const hit = map.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  if (hit) map.delete(key);
  return null;
}
function cacheSet(map: Map<string, { exp: number; value: DriveFileMetadata }>, key: string, value: DriveFileMetadata) {
  if (map.size > 2000) map.clear();
  map.set(key, { exp: Date.now() + METADATA_TTL_MS, value });
}

export async function getDriveFileMetadata(fileId: string): Promise<DriveFileMetadata | null> {
  const cached = cacheGet(metadataCache, fileId);
  if (cached) return cached;
  try {
    const accessToken = await getDriveAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const meta = (await res.json()) as DriveFileMetadata;
    if (meta?.id) cacheSet(metadataCache, fileId, meta);
    return meta;
  } catch {
    return null;
  }
}

/**
 * عندما يكون الرابط المخزّن هو رابط مجلد المادة في Drive (/drive/folders/{folderId})،
 * تبحث هذه الدالة داخل المجلد عن الملف الدراسي الفعلي (PDF/DOCX/PPTX/ZIP...) وتتجاهل ملف معلومات المادة.md،
 * وتعيد بيانات الملف الفعلي ليتم تنزيله مباشرة للطالب دون فتح مجلد Drive!
 */
export async function resolveFileFromDriveFolder(
  folderId: string
): Promise<DriveFileMetadata | null> {
  const cachedFolder = cacheGet(folderCache, folderId);
  if (cachedFolder) return cachedFolder;
  try {
    const accessToken = await getDriveAccessToken();
    const q = `'${folderId.replace(/'/g, "")}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder' and mimeType != 'text/markdown' and name != 'معلومات المادة.md'`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,size,webViewLink)&pageSize=5`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { files?: DriveFileMetadata[] };
    const first = data.files?.[0] ?? null;
    if (first) cacheSet(folderCache, folderId, first);
    return first;
  } catch {
    return null;
  }
}

// ذاكرة مؤقتة لتفادي إعادة منح الصلاحية (طلب كتابة إلى Drive) عند كل معاينة أو تنزيل لنفس الملف.
const publicReaderEnsured = new Map<string, number>();
const PUBLIC_READER_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * يمنح صلاحية القراءة للملف الفردي فقط (وليس المجلد) عند الحاجة لتحويل رابط تنزيل مباشر.
 */
export async function ensureFilePublicReader(fileId: string): Promise<void> {
  const last = publicReaderEnsured.get(fileId);
  if (last && Date.now() - last < PUBLIC_READER_TTL_MS) return;
  try {
    const accessToken = await getDriveAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
        cache: "no-store",
      }
    );
    if (res.ok) {
      publicReaderEnsured.set(fileId, Date.now());
      if (publicReaderEnsured.size > 5000) publicReaderEnsured.clear();
    }
  } catch {
    // تجاهل
  }
}

/**
 * يجلب تدفق بايتات الملف مباشرة من Google Drive API لبثه كملف تنزيل مباشر (Attachment) للطالب
 * دون أن يغادر نطاق الموقع أو يفتح Google Drive إطلاقًا.
 */
export async function fetchDriveFileStream(fileId: string): Promise<Response | null> {
  try {
    const accessToken = await getDriveAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (!res.ok || !res.body) return null;
    return res;
  } catch {
    return null;
  }
}

export async function deleteDriveFile(fileId: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const accessToken = await getDriveAccessToken();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (folderId) {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,parents`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as DriveFileMetadata;
        if (!meta.parents?.includes(folderId)) {
          return false;
        }
      }
    }

    const delRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    return delRes.ok || delRes.status === 404;
  } catch {
    return false;
  }
}

export async function deleteDriveFileByLink(driveLink: string | null | undefined): Promise<boolean> {
  if (!driveLink) return false;
  const fileId = extractDriveFileId(driveLink);
  if (!fileId) return false;
  return deleteDriveFile(fileId);
}

export async function initiateDriveResumableUpload(
  fileName: string,
  mimeType: string,
  fileSize: number,
  origin?: string | null
): Promise<{ sessionUrl: string }> {
  const fileCheck = validateUploadFileMeta(fileName, mimeType, fileSize);
  if (!fileCheck.valid) {
    throw new Error(fileCheck.error || "نوع أو حجم الملف غير مسموح به");
  }

  const accessToken = await getDriveAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID غير مضبوط في متغيرات البيئة");

  // تنظيف اسم الملف من محارف التحكم والمسارات
  const safeName = fileName.replace(/[\u0000-\u001f\u007f\\/]/g, "_").slice(0, 255);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": mimeType || "application/octet-stream",
    "X-Upload-Content-Length": String(fileSize),
  };
  if (origin) headers.Origin = origin;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,size,mimeType",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: safeName,
        mimeType: mimeType || "application/octet-stream",
        parents: [folderId],
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    console.error("Drive resumable init failed:", response.status, message);
    throw new Error(`تعذر بدء رفع الملف إلى Google Drive (${response.status})`);
  }

  const sessionUrl = response.headers.get("location");
  if (!sessionUrl) throw new Error("لم يعطِ Google Drive رابط جلسة الرفع");
  return { sessionUrl };
}

export async function finalizeDriveUpload(
  fileId: string,
  fallbackName = "الملف"
): Promise<DriveUploadResult> {
  if (!fileId || !/^[A-Za-z0-9_-]{10,128}$/.test(fileId)) throw new Error("معرّف الملف غير صالح");

  const accessToken = await getDriveAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID غير مضبوط في متغيرات البيئة");

  const getRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,size,createdTime,trashed`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!getRes.ok) {
    throw new Error("تعذر التحقق من الملف المرفوع في Google Drive");
  }

  const existing = (await getRes.json()) as DriveFileMetadata & { createdTime?: string; trashed?: boolean };
  if (existing.trashed || !existing.parents?.includes(folderId)) {
    throw new Error("الملف لا ينتمي إلى مجلد ملفات الموقع");
  }

  // لا نقبل إنهاء رفع إلا لملف أُنشئ حديثًا (جلسة الرفع الحالية). هذا يمنع استعمال هذا المسار
  // لجعل ملفات قديمة داخل المجلد عامة أو ربطها بمساهمات غير مرتبطة بها.
  const createdMs = existing.createdTime ? Date.parse(existing.createdTime) : NaN;
  if (!Number.isFinite(createdMs) || Date.now() - createdMs > 24 * 60 * 60 * 1000) {
    throw new Error("انتهت صلاحية هذا الرفع، يرجى رفع الملف مرة أخرى");
  }

  const size = Number(existing.size ?? 0);
  if (size > MAX_UPLOAD_BYTES) {
    await deleteDriveFile(fileId);
    throw new Error(`حجم الملف أكبر من الحد المسموح به (${MAX_UPLOAD_LABEL})`);
  }

  const actualName = existing.name || fallbackName;
  const actualMime = existing.mimeType || "application/octet-stream";
  const fileCheck = validateUploadFileMeta(actualName, actualMime, size > 0 ? size : undefined);
  if (!fileCheck.valid) {
    await deleteDriveFile(fileId);
    throw new Error(fileCheck.error || "تم رفض الملف المرفوع لعدم تطابقه مع الأنواع المسموحة");
  }

  await ensureFilePublicReader(fileId);

  return {
    id: fileId,
    name: actualName,
    link: existing.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    size: size > 0 ? size : null,
    mimeType: actualMime,
  };
}

export async function getDriveStorageQuota(): Promise<DriveQuotaInfo | null> {
  try {
    const accessToken = await getDriveAccessToken();
    const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      storageQuota?: {
        limit?: string;
        usage?: string;
        usageInDrive?: string;
        usageInDriveTrash?: string;
      };
    };
    const q = data.storageQuota;
    if (!q) return null;
    const limit = q.limit ? Number(q.limit) : null;
    const usage = Number(q.usage ?? 0);
    const usageInDrive = Number(q.usageInDrive ?? 0);
    const usageInDriveTrash = Number(q.usageInDriveTrash ?? 0);
    const percentUsed = limit && limit > 0 ? Math.round((usage / limit) * 1000) / 10 : null;
    return {
      limit,
      usage,
      usageInDrive,
      usageInDriveTrash,
      percentUsed,
      isNearLimit: percentUsed !== null && percentUsed >= 80,
    };
  } catch {
    return null;
  }
}

// Re-export helper for folder extraction
export { extractDriveFileId, extractDriveFolderId };

// ---------------------------------------------------------------------------
// فحص إعداد Google Drive: أي حساب يرفع؟ وهل يملك صلاحية الكتابة في مجلد الموقع؟
// ---------------------------------------------------------------------------
export interface DriveSetupStatus {
  mode: "oauth" | "service_account" | "unconfigured";
  accountEmail: string | null;
  folderId: string | null;
  folderName: string | null;
  folderOwnerEmail: string | null;
  inSharedDrive: boolean;
  canWrite: boolean | null; // null = تعذر الفحص
  /** هل المجلد مفتوح للتعديل لأي شخص معه الرابط؟ (خطر) — null = تعذر الفحص */
  publicEditAccess: boolean | null;
  error: string | null;
}

export async function checkDriveSetup(): Promise<DriveSetupStatus> {
  const status: DriveSetupStatus = {
    mode: process.env.GOOGLE_OAUTH_REFRESH_TOKEN
      ? "oauth"
      : process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      ? "service_account"
      : "unconfigured",
    accountEmail: null,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID ?? null,
    folderName: null,
    folderOwnerEmail: null,
    inSharedDrive: false,
    canWrite: null,
    publicEditAccess: null,
    error: null,
  };
  if (status.mode === "unconfigured") {
    status.error = "لم يتم ضبط حساب Google Drive في متغيرات البيئة";
    return status;
  }
  if (!status.folderId) {
    status.error = "GOOGLE_DRIVE_FOLDER_ID غير مضبوط";
    return status;
  }

  try {
    const token = await getDriveAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const aboutRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
      headers,
      cache: "no-store",
    });
    if (aboutRes.ok) {
      const about = (await aboutRes.json()) as { user?: { emailAddress?: string } };
      status.accountEmail = about.user?.emailAddress ?? null;
    }

    const folderRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        status.folderId
      )}?supportsAllDrives=true&fields=id,name,mimeType,driveId,owners(emailAddress),capabilities(canAddChildren),permissions(type,role)`,
      { headers, cache: "no-store" }
    );
    if (folderRes.status === 404) {
      status.canWrite = false;
      status.error = "الحساب لا يرى المجلد أبدًا: المعرّف خاطئ أو المجلد غير مشارك مع الحساب";
      return status;
    }
    if (!folderRes.ok) {
      status.error = `تعذر قراءة المجلد (${folderRes.status})`;
      return status;
    }
    const folder = (await folderRes.json()) as {
      name?: string;
      mimeType?: string;
      driveId?: string;
      owners?: { emailAddress?: string }[];
      capabilities?: { canAddChildren?: boolean };
      permissions?: { type?: string; role?: string }[];
    };
    status.folderName = folder.name ?? null;
    status.folderOwnerEmail = folder.owners?.[0]?.emailAddress ?? null;
    status.inSharedDrive = Boolean(folder.driveId);
    // أي صلاحية عامة (anyone/domain) أعلى من «مشاهد» تعني أن الرابط وحده يكفي للتعديل
    if (folder.permissions) {
      status.publicEditAccess = folder.permissions.some(
        (p) =>
          (p.type === "anyone" || p.type === "domain") &&
          ["writer", "fileOrganizer", "organizer", "owner"].includes(p.role ?? "")
      );
    }
    if (folder.mimeType !== "application/vnd.google-apps.folder") {
      status.canWrite = false;
      status.error = "المعرّف المضبوط ليس معرّف مجلد";
      return status;
    }
    status.canWrite = folder.capabilities?.canAddChildren === true;
    if (!status.canWrite) {
      status.error = "الحساب يرى المجلد لكنه لا يملك صلاحية «محرر» عليه";
    }
    return status;
  } catch (err) {
    status.error = err instanceof Error ? err.message : "تعذر فحص إعداد Drive";
    return status;
  }
}

let writableCache: { ok: boolean; exp: number } | null = null;

/** فحص سريع مخزّن مؤقتًا: هل يستطيع حساب الرفع الكتابة في مجلد الموقع؟ (null = لا نعرف) */
export async function isDriveFolderWritable(): Promise<boolean | null> {
  if (writableCache && writableCache.exp > Date.now()) return writableCache.ok;
  const s = await checkDriveSetup();
  if (s.canWrite === null) return null;
  writableCache = { ok: s.canWrite, exp: Date.now() + (s.canWrite ? 10 * 60_000 : 60_000) };
  return s.canWrite;
}
