import "server-only";
import { google, drive_v3 } from "googleapis";
import { Readable } from "stream";

// كل ملفات الموقع تُخزَّن في Google Drive الخاص بالموقع (وليس حساب المستخدم)
// عبر حساب خدمة (Service Account). راجع .env.example للمتغيرات المطلوبة:
// GOOGLE_OAUTH_* (أو حساب الخدمة) و GOOGLE_DRIVE_FOLDER_ID.
//
// البنية داخل Drive:  المجلد الجذر / مجلد لكل مساق (باسم المساق) / الملفات
// كل ملف يحمل appProperties { push: "1", course_id, uploader } حتى نستطيع
// التحقق لاحقًا أن الرابط المُرسَل هو فعلًا ملف رفعه الموقع نفسه.

const FOLDER_MIME = "application/vnd.google-apps.folder";

// طريقتان للاتصال بـ Drive (تُفضَّل الأولى):
// 1) OAuth بحساب المؤسس نفسه: تُنشأ الملفات باسم المؤسس وتُحسب على مساحة Drive
//    الخاص به. المتغيرات: GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN
// 2) حساب خدمة (Service Account): يعمل فقط مع Shared Drive لأنه لا يملك مساحة تخزين.
function getAuth() {
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
    throw new Error("لم يتم ربط Google Drive الخاص بالمؤسس (راجع .env.example: GOOGLE_OAUTH_*)");
  }
  // مفاتيح Google الخاصة تُخزَّن عادة في .env بأسطر جديدة مكتوبة كـ \n حرفيًا.
  const key = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  return new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/drive"] });
}

function getDrive(): drive_v3.Drive {
  return google.drive({ version: "v3", auth: getAuth() });
}

// يقبل معرّف المجلد مباشرة أو رابط المجلد الكامل كما ينسخه المؤسس من Drive.
function rootFolderId(): string {
  const raw = (process.env.GOOGLE_DRIVE_FOLDER_ID ?? "").trim();
  if (!raw) throw new Error("لم يتم ضبط GOOGLE_DRIVE_FOLDER_ID في متغيرات البيئة (مجلد المؤسس في Drive)");
  const fromUrl = raw.match(/\/folders\/([\w-]+)/) ?? raw.match(/[?&]id=([\w-]+)/);
  return fromUrl ? fromUrl[1] : raw;
}

// يستخرج معرّف الملف من أي شكل شائع لروابط Drive.
export function extractDriveFileId(link: string): string | null {
  const s = String(link ?? "").trim();
  if (!s) return null;
  try {
    const url = new URL(s);
    if (!/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/.test(url.hostname)) return null;
    const byPath = url.pathname.match(/\/d\/([\w-]{10,})/);
    if (byPath) return byPath[1];
    const byQuery = url.searchParams.get("id");
    return byQuery && /^[\w-]{10,}$/.test(byQuery) ? byQuery : null;
  } catch {
    return null;
  }
}

function escapeQuery(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// مجلد المساق داخل المجلد الجذر: يُبحث عنه بمعرّف المساق (وليس بالاسم) حتى لا
// يتكرر أو يضيع عند تعديل اسم المساق، وإن لم يوجد يُنشأ.
export async function getOrCreateCourseFolder(courseId: string, courseName: string): Promise<string> {
  const drive = getDrive();
  const parent = rootFolderId();
  const found = await drive.files.list({
    q: `'${escapeQuery(parent)}' in parents and mimeType='${FOLDER_MIME}' and trashed=false and appProperties has { key='course_id' and value='${escapeQuery(courseId)}' }`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = found.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: { name: courseName || courseId, mimeType: FOLDER_MIME, parents: [parent], appProperties: { push: "1", course_id: courseId } },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new Error("تعذر إنشاء مجلد المساق في Google Drive");
  return created.data.id;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  link: string;
  folderId: string;
}

export async function uploadFileToDrive(params: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  courseId: string;
  courseName: string;
  uploaderId: string;
}): Promise<DriveUploadResult> {
  const drive = getDrive();
  const folderId = await getOrCreateCourseFolder(params.courseId, params.courseName);

  const created = await drive.files.create({
    requestBody: {
      name: params.fileName,
      parents: [folderId],
      appProperties: { push: "1", course_id: params.courseId, uploader: params.uploaderId },
    },
    media: { mimeType: params.mimeType || "application/octet-stream", body: Readable.from(params.buffer) },
    fields: "id,name,webViewLink",
    supportsAllDrives: true,
  });

  const fileId = created.data.id;
  if (!fileId) throw new Error("تعذر رفع الملف إلى Google Drive");

  // أي شخص يملك الرابط يمكنه العرض/التحميل (بدون تعديل)، لأن روابط المواد
  // في الموقع عامة لكل الزوار.
  await drive.permissions.create({ fileId, requestBody: { role: "reader", type: "anyone" }, supportsAllDrives: true });

  return {
    id: fileId,
    name: created.data.name || params.fileName,
    link: created.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    folderId,
  };
}

// هل هذا الرابط لملف رفعه الموقع نفسه إلى Drive؟ (يُستخدم لرفض أي رابط خارجي).
// يُقبل الملف إذا كان موسومًا بـ appProperties.push، أو موجودًا مباشرة داخل
// المجلد الجذر (ملفات الإصدار القديم قبل مجلدات المساقات).
export async function isSiteDriveLink(link: string): Promise<boolean> {
  const id = extractDriveFileId(link);
  if (!id) return false;
  try {
    const drive = getDrive();
    const { data } = await drive.files.get({ fileId: id, fields: "id,trashed,mimeType,parents,appProperties", supportsAllDrives: true });
    if (data.trashed || data.mimeType === FOLDER_MIME) return false;
    if (data.appProperties?.push === "1") return true;
    return (data.parents ?? []).includes(rootFolderId());
  } catch {
    return false;
  }
}

// ينقل الملف إلى سلة Drive (يمكن استرجاعه من هناك) بدل الحذف النهائي.
export async function trashDriveLink(link: string | null | undefined): Promise<void> {
  const id = link ? extractDriveFileId(link) : null;
  if (!id) return;
  try {
    const drive = getDrive();
    const { data } = await drive.files.get({ fileId: id, fields: "appProperties,parents", supportsAllDrives: true });
    // لا نلمس إلا ملفات الموقع نفسها.
    if (data.appProperties?.push !== "1" && !(data.parents ?? []).includes(rootFolderId())) return;
    await drive.files.update({ fileId: id, requestBody: { trashed: true }, supportsAllDrives: true });
  } catch {
    // فشل التنظيف في Drive لا يجب أن يمنع حذف السجل من الموقع.
  }
}

// ينقل مجلد المساق (وكل ما فيه) إلى السلة.
export async function trashCourseFolder(courseId: string): Promise<void> {
  try {
    const drive = getDrive();
    const found = await drive.files.list({
      q: `'${escapeQuery(rootFolderId())}' in parents and mimeType='${FOLDER_MIME}' and trashed=false and appProperties has { key='course_id' and value='${escapeQuery(courseId)}' }`,
      fields: "files(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of found.data.files ?? []) {
      if (f.id) await drive.files.update({ fileId: f.id, requestBody: { trashed: true }, supportsAllDrives: true });
    }
  } catch {
    // تجاهل — انظر التعليق أعلاه.
  }
}
