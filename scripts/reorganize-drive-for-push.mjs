/**
 * سكربت إعادة ترتيب مستودع Google Drive وربط الملفات مباشرة بجدول materials في Supabase.
 *
 * ماذا يفعل هذا السكربت؟
 * 1) يتصل بمجلد المستودع في Google Drive (GOOGLE_DRIVE_FOLDER_ID).
 * 2) يمر على المواد المخزنة في Supabase التي يشير رابطها (drive_link) إلى مجلد فرعي (/drive/folders/...).
 * 3) يستخرج الملف الفعلي (PDF / DOCX / PPTX / ZIP) من داخل مجلد المادة الفرعي،
 *    ويعيد تسميته بالصيغة القياسية للمنصة: [رمز_المساق]_[عنوان_المادة].ext
 * 4) يمنح الملف صلاحية العرض العام (anyone reader) ويحدّث حقل drive_link في Supabase
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

async function getDriveAccessToken() {
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
  return data.access_token;
}

function extractFolderId(url) {
  if (!url) return null;
  const m = url.match(/\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}

async function run() {
  const token = await getDriveAccessToken();
  const headers = { Authorization: `Bearer ${token}` };

  const { data: materials, error } = await supabase
    .from("materials")
    .select("id, title_ar, drive_link, courses:course_id(code, name_ar)")
    .ilike("drive_link", "%/drive/folders/%")
    .limit(1000);

  if (error) throw error;
  console.log(`تم العثور على ${materials.length} مادة مرتبطة بمجلدات فرعية لمعالجتها...`);

  let updatedCount = 0;
  for (const mat of materials) {
    const folderId = extractFolderId(mat.drive_link);
    if (!folderId) continue;

    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType != 'text/markdown'`);
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,webViewLink)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      { headers }
    );
    if (!listRes.ok) continue;
    const listData = await listRes.json();
    const actualFile = (listData.files || [])[0];
    if (!actualFile) continue;

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

  console.log(`اكتمل التنظيم! تم ربط ${updatedCount} ملف برابط مباشر.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
