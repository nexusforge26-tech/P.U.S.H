import "server-only";
import { google } from "googleapis";
import { Readable } from "stream";

// يرفع الملفات مباشرة إلى حساب Google Drive الخاص بالموقع (وليس حساب المستخدم)
// عبر حساب خدمة (Service Account). راجع .env.example لمتغيرات البيئة المطلوبة:
// GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID.

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("لم يتم ضبط حساب خدمة Google Drive في متغيرات البيئة (راجع .env.example)");
  }
  // مفاتيح Google الخاصة تُخزَّن عادة في .env بأسطر جديدة مكتوبة كـ \n حرفيًا.
  const key = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  return new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/drive"] });
}

export interface DriveUploadResult {
  id: string;
  name: string;
  link: string;
}

export async function uploadFileToDrive(buffer: Buffer, fileName: string, mimeType: string): Promise<DriveUploadResult> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || undefined;

  const created = await drive.files.create({
    requestBody: { name: fileName, parents: folderId ? [folderId] : undefined },
    media: { mimeType: mimeType || "application/octet-stream", body: Readable.from(buffer) },
    fields: "id,name,webViewLink",
  });

  const fileId = created.data.id;
  if (!fileId) throw new Error("تعذر رفع الملف إلى Google Drive");

  // أي شخص يملك الرابط يمكنه العرض/التحميل (بدون تعديل)، لأن روابط المواد
  // في الموقع عامة لكل الزوار.
  await drive.permissions.create({ fileId, requestBody: { role: "reader", type: "anyone" } });

  const info = await drive.files.get({ fileId, fields: "id,name,webViewLink" });
  return {
    id: fileId,
    name: info.data.name || fileName,
    link: info.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
  };
}
