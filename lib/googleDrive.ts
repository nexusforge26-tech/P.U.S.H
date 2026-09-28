import "server-only";
import { google } from "googleapis";

// Google Drive الخاص بالموقع.
// الأولوية: OAuth عبر Refresh Token لحساب Google شخصي (يستخدم مساحة ذلك الحساب).
// البديل: Service Account، ويعمل فقط مع Shared Drive (لأنه لا يملك مساحة تخزين).
type DriveAuth = InstanceType<typeof google.auth.OAuth2>;

function getAuth(): DriveAuth {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth = new google.auth.OAuth2(clientId, clientSecret);
    oauth.setCredentials({ refresh_token: refreshToken });
    return oauth;
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("لم يتم ضبط حساب Google Drive في متغيرات البيئة");
  }
  const key = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

export interface DriveUploadResult {
  id: string;
  name: string;
  link: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Starts a Google Drive resumable upload.
 * Only the small initiation request passes through Vercel; the actual file
 * bytes are uploaded by the browser directly to Google's resumable session.
 */
export async function initiateDriveResumableUpload(
  fileName: string,
  mimeType: string,
  fileSize: number,
): Promise<{ sessionUrl: string }> {
  if (!fileName || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    throw new Error("حجم الملف غير صالح أو أكبر من الحد المسموح به (25 ميجابايت)");
  }

  const auth = getAuth();
  const tokenResult = await auth.getAccessToken();
  const accessToken = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
  if (!accessToken) throw new Error("تعذر الحصول على رمز Google Drive");

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID غير مضبوط في متغيرات البيئة");

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType || "application/octet-stream",
        "X-Upload-Content-Length": String(fileSize),
      },
      body: JSON.stringify({
        name: fileName,
        mimeType: mimeType || "application/octet-stream",
        parents: [folderId],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`تعذر بدء رفع الملف إلى Google Drive (${response.status})${message ? `: ${message}` : ""}`);
  }

  const sessionUrl = response.headers.get("location");
  if (!sessionUrl) throw new Error("لم يعطِ Google Drive رابط جلسة الرفع");
  return { sessionUrl };
}

/**
 * Finalizes permissions/link after the browser finishes the resumable upload.
 * The file ID comes from Google's successful upload response.
 */
export async function finalizeDriveUpload(fileId: string, fallbackName = "الملف"): Promise<DriveUploadResult> {
  if (!fileId) throw new Error("معرّف الملف مفقود");

  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID غير مضبوط في متغيرات البيئة");

  // لا نمنح صلاحية عامة إلا لملف موجود داخل مجلد الموقع.
  const existing = await drive.files.get({ fileId, supportsAllDrives: true, fields: "id,name,parents,webViewLink" });
  if (!existing.data.parents?.includes(folderId)) {
    throw new Error("الملف لا ينتمي إلى مجلد ملفات الموقع");
  }

  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: { role: "reader", type: "anyone" },
  });

  const info = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "id,name,webViewLink",
  });

  return {
    id: fileId,
    name: info.data.name || fallbackName,
    link: info.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
  };
}

// الإبقاء على الدالة القديمة لأي استخدام داخلي مستقبلي.
// لا تُستخدم من مسار الرفع الجديد حتى لا يمر الملف الكبير عبر Vercel.
export async function uploadFileToDrive(buffer: Buffer, fileName: string, mimeType: string): Promise<DriveUploadResult> {
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("حجم الملف أكبر من الحد المسموح به (25 ميجابايت)");
  }
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID غير مضبوط في متغيرات البيئة");
  const { Readable } = await import("stream");

  const created = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
    fields: "id,name,webViewLink",
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error("تعذر رفع الملف إلى Google Drive");
  return finalizeDriveUpload(fileId, fileName);
}
