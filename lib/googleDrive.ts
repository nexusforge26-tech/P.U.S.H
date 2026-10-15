import "server-only";
import crypto from "crypto";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  validateUploadFileMeta,
} from "@/lib/uploadLimits";
import { extractDriveFileId } from "@/lib/validation";
import type { DriveQuotaInfo } from "@/lib/types";

// Google Drive الخاص بالموقع بدون مكتبة googleapis الضخمة (نستخدم fetch المباشر + crypto المدمج في Node.js).
// الأولوية: OAuth عبر Refresh Token لحساب Google شخصي (يستخدم مساحة ذلك الحساب).
// البديل: Service Account، ويعمل فقط مع Shared Drive في Google Workspace (لأنه لا يملك مساحة تخزين خاصة).

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
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
      throw new Error(`تعذر تجديد رمز OAuth لحساب Google Drive (${res.status}): ${errText}`);
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
    throw new Error(`تعذر مصادقة حساب خدمة Google Drive (${res.status}): ${errText}`);
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

interface DriveFileMetadata {
  id: string;
  name?: string;
  mimeType?: string;
  parents?: string[];
  webViewLink?: string;
  size?: string;
}

/**
 * يحذف ملفًا من Google Drive (إذا كان ينتمي لمجلد الموقع).
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  if (!fileId) return false;
  try {
    const accessToken = await getAccessToken();
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
          // لا نحذف ملفًا خارج مجلد الموقع
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

/**
 * يحذف ملف Drive مرتبطًا برابط إذا كان داخل مجلد الموقع (يُستدعى عند رفض مساهمة أو حذف مادة).
 */
export async function deleteDriveFileByLink(driveLink: string | null | undefined): Promise<boolean> {
  if (!driveLink) return false;
  const fileId = extractDriveFileId(driveLink);
  if (!fileId) return false;
  return deleteDriveFile(fileId);
}

/**
 * يبدأ جلسة رفع قابلة للاستئناف (Resumable) في Google Drive بعد التحقق من الامتداد والـ MIME والحجم.
 */
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

  const accessToken = await getAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID غير مضبوط في متغيرات البيئة");

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
        name: fileName,
        mimeType: mimeType || "application/octet-stream",
        parents: [folderId],
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `تعذر بدء رفع الملف إلى Google Drive (${response.status})${message ? `: ${message}` : ""}`
    );
  }

  const sessionUrl = response.headers.get("location");
  if (!sessionUrl) throw new Error("لم يعطِ Google Drive رابط جلسة الرفع");
  return { sessionUrl };
}

/**
 * بعد أن ينهي المتصفح الرفع المباشر: يتحقق من نوع وحجم الملف الفعلي من Google Drive،
 * ويحذفه فورًا إن كان مخالفًا، ثم يمنح صلاحية القراءة ويعيد الرابط وبيانات الملف.
 */
export async function finalizeDriveUpload(
  fileId: string,
  fallbackName = "الملف"
): Promise<DriveUploadResult> {
  if (!fileId) throw new Error("معرّف الملف مفقود");

  const accessToken = await getAccessToken();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID غير مضبوط في متغيرات البيئة");

  const getRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=id,name,mimeType,parents,webViewLink,size`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );

  if (!getRes.ok) {
    throw new Error("تعذر التحقق من الملف المرفوع في Google Drive");
  }

  const existing = (await getRes.json()) as DriveFileMetadata;
  if (!existing.parents?.includes(folderId)) {
    throw new Error("الملف لا ينتمي إلى مجلد ملفات الموقع");
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

  const permRes = await fetch(
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

  if (!permRes.ok) {
    throw new Error("تعذر ضبط صلاحيات عرض الملف في Google Drive");
  }

  return {
    id: fileId,
    name: actualName,
    link: existing.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    size: size > 0 ? size : null,
    mimeType: actualMime,
  };
}

/**
 * يستعلم عن حالة مساحة تخزين حساب Google Drive لتنبيه الإدارة عند الاقتراب من الحد (15GB).
 */
export async function getDriveStorageQuota(): Promise<DriveQuotaInfo | null> {
  try {
    const accessToken = await getAccessToken();
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
