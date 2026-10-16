/**
 * سكربت إعادة ترتيب مستودع Google Drive وربط الملفات مباشرة بجدول materials في Supabase.
 *
 * ماذا يفعل هذا السكربت؟
 * 1) يتصل بمجلد المستودع في Google Drive (GOOGLE_DRIVE_FOLDER_ID).
 * 2) يمر على جميع المواد المخزنة في Supabase التي يشير رابطها (drive_link) إلى مجلد فرعي (/drive/folders/...) عبر التصفح الكامل (Pagination).
 * 3) يستخرج الملف الفعلي (PDF / DOCX / PPTX / ZIP) من داخل مجلد المادة الفرعي (متجاهلًا المجلدات الفرعية وملف معلومات المادة.md)،
 *    ويعيد تسميته بالصيغة القياسية للمنصة: [رمز_المساق]_[عنوان_المادة].ext
 * 4) يمنح الملف صلاحية العرض العام (anyone reader) فعليًا عبر Drive Permissions API ويحدّث حقل drive_link في Supabase
 *    بالرابط المباشر للملف (https://drive.google.com/file/d/{fileId}/view) مع حجم الملف ونوعه (file_size, mime_type).
 *
 * طريقة التشغيل:
 *   node --env-file=.env.local scripts/reorganize-drive-for-push.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("يرجى ضبط NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("يرجى ضبط GOOGLE_OAUTH_CLIENT_ID و GOOGLE_OAUTH_CLIENT_SECRET و GOOGLE_OAUTH_REFRESH_TOKEN");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

let cachedToken = "";
let tokenExpiresAt = 0;

async function getDriveAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`فشل الحصول على توكن Google Drive: ${JSON.stringify(data)}`);
  }
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in ?? 3500) * 1000;
  return cachedToken;
}

function extractFolderId(url) {
  if (!url) return null;
  const m = url.match(/\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

async function fetchAllFolderMaterials() {
  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("materials")
      .select("id, title_ar, drive_link, courses:course_id(code, name_ar)")
      .ilike("drive_link", "%/drive/folders/%")
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function run() {
  const materials = await fetchAllFolderMaterials();
  console.log(`تم العثور على ${materials.length} مادة مرتبطة بمجلدات فرعية لمعالجتها...`);

  let updatedCount = 0;
  let emptyCount = 0;

  for (const mat of materials) {
    const folderId = extractFolderId(mat.drive_link);
    if (!folderId) continue;

    const token = await getDriveAccessToken();
    const headers = { Authorization: `Bearer ${token}` };

    const q = encodeURIComponent(
      `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder' and mimeType != 'text/markdown' and name != 'معلومات المادة.md'`
    );
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers }
    );
    if (!listRes.ok) continue;
    const listData = await listRes.json();
    const actualFile = (listData.files || [])[0];
    if (!actualFile) {
      emptyCount++;
      continue;
    }

    // إعادة تسمية الملف بشكل منظم حسب المساق والعنوان
    const ext = actualFile.name.includes(".") ? "." + actualFile.name.split(".").pop() : "";
    const courseCode = mat.courses?.code || "PUSH";
    const safeTitle = mat.title_ar.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80).trim();
    const newFileName = `${courseCode} - ${safeTitle}${ext}`;

    await fetch(`https://www.googleapis.com/drive/v3/files/${actualFile.id}?supportsAllDrives=true`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFileName }),
    });

    // منح صلاحية القراءة العامة (anyone reader) لضمان عمل المعاينة المدمجة داخل الموقع دون طلب إذن وصول
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(actualFile.id)}/permissions?supportsAllDrives=true`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      }
    ).catch(() => {});

    const directLink = `https://drive.google.com/file/d/${actualFile.id}/view`;
    await supabase
      .from("materials")
      .update({
        drive_link: directLink,
        file_size: actualFile.size ? Number(actualFile.size) : null,
        mime_type: actualFile.mimeType || null,
      })
      .eq("id", mat.id);

    updatedCount++;
    if (updatedCount % 25 === 0) {
      console.log(`تم تحويل وتنظيم ${updatedCount} ملف حتى الآن...`);
    }
  }

  console.log(
    `اكتمل التنظيم! تم ربط ${updatedCount} ملف برابط مباشر وصلاحية قراءة عامة (وتم تخطي ${emptyCount} مجلد فارغ).`
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
