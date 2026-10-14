import "server-only";
import { google } from "googleapis";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/uploadLimits";

// Google Drive الخاص بالموقع.
// الأولوية: OAuth عبر Refresh Token لحساب Google شخصي (يستخدم مساحة ذلك الحساب).
// البديل: Service Account، ويعمل فقط مع Shared Drive (لأنه لا يملك مساحة تخزين).
//
// مبدأ الرفع: الملف لا يمر أبدًا عبر سيرفر الموقع (Vercel) ولا عبر Supabase.
//  1) المتصفح يطلب من السيرفر "جلسة رفع" صغيرة (JSON فقط).
//  2) المتصفح يرفع بايتات الملف مباشرة إلى Google Drive عبر رابط الجلسة.
//  3) المتصفح يطلب من السيرفر "إنهاء" صغيرًا ليجعل الملف قابلًا للعرض ويعيد الرابط.
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

/**
 * يبدأ جلسة رفع قابلة للاستئناف (Resumable) في Google Drive.
 * يمر عبر السيرفر طلب صغير فقط؛ بايتات الملف يرفعها المتصفح مباشرة إلى Google.
 *
 * `origin` مهم جدًا: Google تربط صلاحية CORS لرابط الجلسة بقيمة Origin التي أُرسلت
 * عند إنشاء الجلسة. بدونه يرفض المتصفح الرفع المباشر من نطاق الموقع.
 */
export async function initiateDriveResumableUpload(
  fileName: string,
  mimeType: string,
  fileSize: number,
  origin?: string | null,
): Promise<{ sessionUrl: string }> {
  if (!fileName || !Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("بيانات الملف غير صالحة");
  }
  if (fileSize > MAX_UPLOAD_BYTES) {
    throw new Error(`حجم الملف أكبر من الحد المسموح به (${MAX_UPLOAD_LABEL})`);
  }

  const auth = getAuth();
  const tokenResult = await auth.getAccessToken();
  const accessToken = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
  if (!accessToken) throw new Error("تعذر الحصول على رمز Google Drive");

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
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,size",
    {
      method: "POST",
      headers,
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
 * بعد أن ينهي المتصفح الرفع المباشر: يجعل الملف قابلًا للعرض لمن لديه الرابط
 * ويعيد رابط المعاينة. معرّف الملف يأتي من ردّ Google النهائي على المتصفح.
 */
export async function finalizeDriveUpload(fileId: string, fallbackName = "الملف"): Promise<DriveUploadResult> {
  if (!fileId) throw new Error("معرّف الملف مفقود");

  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID غير مضبوط في متغيرات البيئة");

  // لا نمنح صلاحية عامة إلا لملف موجود داخل مجلد الموقع.
  const existing = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: "id,name,parents,webViewLink,size",
  });
  if (!existing.data.parents?.includes(folderId)) {
    throw new Error("الملف لا ينتمي إلى مجلد ملفات الموقع");
  }

  // حماية إضافية: Google تفرض الحجم المعلن عند بدء الجلسة، لكن نتحقق هنا أيضًا.
  const size = Number(existing.data.size ?? 0);
  if (size > MAX_UPLOAD_BYTES) {
    await drive.files.delete({ fileId, supportsAllDrives: true }).catch(() => {});
    throw new Error(`حجم الملف أكبر من الحد المسموح به (${MAX_UPLOAD_LABEL})`);
  }

  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    id: fileId,
    name: existing.data.name || fallbackName,
    link: existing.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
  };
}
