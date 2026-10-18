// حدود وقواعد رفع الملفات — ملف مشترك بين المتصفح والسيرفر (لا يحتوي أي كود سري).
// 1 جيجابايت = 1024 * 1024 * 1024 بايت.
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "1 جيجابايت";

// الحد الأقصى لعدد المساهمات المعلقة لكل مستخدم في نفس الوقت لمنع الإغراق (Rate Limit).
export const MAX_PENDING_SUBMISSIONS_PER_USER = 10;

// حصة الرفع اليومية للمستخدم العادي (المسؤولون غير مقيّدين) لحماية مساحة Google Drive من الاستنزاف.
export const MAX_UPLOADS_PER_DAY = 20;
export const MAX_UPLOAD_BYTES_PER_DAY = 3 * 1024 * 1024 * 1024;

// الامتدادات المسموح برفعها إلى Google Drive العام للموقع.
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "md",
  "rtf",
  "odt",
  "ods",
  "odp",
  "zip",
  "rar",
  "7z",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
]);

// الامتدادات المحظورة صراحةً لمنع البرمجيات الخبيثة وصفحات التصيد (HTML/SVG/Scripts/Executables).
export const BLOCKED_UPLOAD_EXTENSIONS = new Set([
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "pif",
  "vbs",
  "vbe",
  "js",
  "jse",
  "mjs",
  "cjs",
  "wsf",
  "wsh",
  "ps1",
  "sh",
  "bash",
  "apk",
  "ipa",
  "dmg",
  "pkg",
  "deb",
  "rpm",
  "app",
  "html",
  "htm",
  "xhtml",
  "svg",
  "php",
  "py",
  "rb",
  "pl",
  "jar",
  "dll",
  "so",
  "dylib",
  "iso",
  "img",
]);

export const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.",
  "application/rtf",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  // بعض المتصفحات ترسل application/octet-stream للملفات المضغوطة أو أوفيس؛ نقبلها بشرط تطابق الامتداد الآمن
  "application/octet-stream",
];

export const BLOCKED_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/javascript",
  "text/javascript",
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "application/x-httpd-php",
]);

export function getFileExtension(fileName: string): string {
  const clean = fileName.trim().toLowerCase();
  const parts = clean.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1] ?? "";
}

export function validateUploadFileMeta(
  fileName: string,
  mimeType?: string | null,
  fileSize?: number
): { valid: boolean; error?: string; extension: string } {
  const name = String(fileName || "").trim();
  if (!name) {
    return { valid: false, error: "اسم الملف مطلوب", extension: "" };
  }

  const ext = getFileExtension(name);
  if (!ext) {
    return {
      valid: false,
      error: "يجب أن يحتوي الملف على امتداد واضح (مثل .pdf أو .docx أو .pptx أو .zip)",
      extension: "",
    };
  }

  // امتداد مزدوج مخادع مثل report.html.pdf أو app.exe.zip: نمنع وجود امتداد محظور داخل الاسم نفسه
  const nameParts = name.toLowerCase().split(".").slice(1, -1);
  if (nameParts.some((part) => BLOCKED_UPLOAD_EXTENSIONS.has(part.trim()))) {
    return {
      valid: false,
      error: "اسم الملف يحتوي على امتداد غير مسموح به، يرجى إعادة تسميته.",
      extension: ext,
    };
  }

  if (BLOCKED_UPLOAD_EXTENSIONS.has(ext) || !ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `نوع الملف (.${ext}) غير مسموح به. الأنواع المسموحة: PDF، ملفات Office (Word/PowerPoint/Excel)، الصور (PNG/JPG/WebP)، والملفات المضغوطة (ZIP/RAR/7Z).`,
      extension: ext,
    };
  }

  if (mimeType) {
    const cleanMime = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
    if (BLOCKED_MIME_TYPES.has(cleanMime)) {
      return {
        valid: false,
        error: `نوع محتوى الملف (${cleanMime}) غير مسموح به لأسباب أمنية.`,
        extension: ext,
      };
    }
    if (
      cleanMime &&
      !ALLOWED_MIME_PREFIXES.some((prefix) => cleanMime === prefix || cleanMime.startsWith(prefix))
    ) {
      return {
        valid: false,
        error: `نوع محتوى الملف (${cleanMime}) غير مدعوم.`,
        extension: ext,
      };
    }
  }

  if (fileSize !== undefined) {
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return { valid: false, error: "حجم الملف غير صالح أو الملف فارغ", extension: ext };
    }
    if (fileSize > MAX_UPLOAD_BYTES) {
      return {
        valid: false,
        error: `حجم الملف (${formatBytes(fileSize)}) أكبر من الحد المسموح به (${MAX_UPLOAD_LABEL})`,
        extension: ext,
      };
    }
  }

  return { valid: true, extension: ext };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatMimeLabel(mimeType?: string | null, driveLink?: string | null): string | null {
  if (mimeType) {
    const m = mimeType.toLowerCase();
    if (m.includes("pdf")) return "PDF";
    if (m.includes("word") || m.includes("document")) return "Word";
    if (m.includes("presentation") || m.includes("powerpoint")) return "PowerPoint";
    if (m.includes("spreadsheet") || m.includes("excel") || m.includes("csv")) return "Excel/CSV";
    if (m.includes("zip") || m.includes("rar") || m.includes("7z") || m.includes("compressed")) return "ملف مضغوط";
    if (m.startsWith("image/")) return "صورة";
    if (m.startsWith("text/")) return "ملف نصي";
  }
  if (driveLink && driveLink.includes("drive.google.com")) {
    return "مستند Drive";
  }
  return null;
}
