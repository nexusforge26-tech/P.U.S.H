import { SEMESTER_LABELS, type MaterialType } from "./types";

export const MAX_TITLE_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 1500;
export const MAX_ACADEMIC_YEAR_LENGTH = 20;

const ALLOWED_MATERIAL_TYPES = new Set<MaterialType>(["exam", "summary", "file", "video"]);
const ALLOWED_SEMESTERS = new Set<string>(Object.keys(SEMESTER_LABELS));

const TRUSTED_LINK_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "onedrive.live.com",
  "1drv.ms",
  "dropbox.com",
  "www.dropbox.com",
  "dl.dropboxusercontent.com",
  "mega.nz",
  "github.com",
  "raw.githubusercontent.com",
  "archive.org",
  "www.archive.org",
  "antiexam.com",
  "www.antiexam.com",
]);

export interface LinkValidationResult {
  valid: boolean;
  url: string | null;
  isDrive: boolean;
  driveFileId: string | null;
  driveFolderId: string | null;
  error?: string;
}

/**
 * يستخرج معرّف ملف Google Drive من روابط الملفات المباشرة.
 */
export function extractDriveFileId(rawLink: string): string | null {
  if (typeof rawLink !== "string" || !rawLink.trim()) return null;
  try {
    const url = new URL(rawLink.trim());
    const host = url.hostname.toLowerCase();
    if (host !== "drive.google.com" && host !== "docs.google.com") {
      return null;
    }

    if (url.pathname.includes("/folders/") || url.pathname.includes("/folderview")) {
      return null;
    }

    const dMatch = url.pathname.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([A-Za-z0-9_-]{10,})/);
    if (dMatch?.[1]) return dMatch[1];

    const idParam = url.searchParams.get("id");
    if (idParam && /^[A-Za-z0-9_-]{10,}$/.test(idParam)) {
      return idParam;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * يستخرج معرّف مجلد Google Drive من روابط المجلدات (/drive/folders/{id} أو /folderview?id={id}).
 */
export function extractDriveFolderId(rawLink: string): string | null {
  if (typeof rawLink !== "string" || !rawLink.trim()) return null;
  try {
    const url = new URL(rawLink.trim());
    const host = url.hostname.toLowerCase();
    if (host !== "drive.google.com") return null;

    const fMatch = url.pathname.match(/\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{10,})/);
    if (fMatch?.[1]) return fMatch[1];

    if (url.pathname.includes("/folderview")) {
      const idParam = url.searchParams.get("id");
      if (idParam && /^[A-Za-z0-9_-]{10,}$/.test(idParam)) return idParam;
    }

    return null;
  } catch {
    return null;
  }
}

export function validateLink(
  raw: unknown,
  options: { driveOnly?: boolean; allowTrustedExternal?: boolean } = {}
): LinkValidationResult {
  const { driveOnly = false, allowTrustedExternal = true } = options;

  if (typeof raw !== "string" || !raw.trim()) {
    return { valid: false, url: null, isDrive: false, driveFileId: null, driveFolderId: null, error: "الرابط مطلوب" };
  }

  const trimmed = raw.trim();
  if (trimmed.length > 2048) {
    return { valid: false, url: null, isDrive: false, driveFileId: null, driveFolderId: null, error: "الرابط طويل جدًا" };
  }

  if (/^(javascript|data|vbscript|file|blob|about):/i.test(trimmed)) {
    return {
      valid: false,
      url: null,
      isDrive: false,
      driveFileId: null,
      driveFolderId: null,
      error: "نوع الرابط غير مسموح به لأسباب أمنية",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      url: null,
      isDrive: false,
      driveFileId: null,
      driveFolderId: null,
      error: "صيغة الرابط غير صالحة (يجب أن يبدأ بـ https://)",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      valid: false,
      url: null,
      isDrive: false,
      driveFileId: null,
      driveFolderId: null,
      error: "يُسمح فقط بالروابط الآمنة التي تبدأ بـ https://",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      url: null,
      isDrive: false,
      driveFileId: null,
      driveFolderId: null,
      error: "الرابط يحتوي على بيانات اعتماد غير مسموحة",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0)/.test(host)
  ) {
    return {
      valid: false,
      url: null,
      isDrive: false,
      driveFileId: null,
      driveFolderId: null,
      error: "لا يُسمح بالروابط المحلية",
    };
  }

  const isDrive = host === "drive.google.com" || host === "docs.google.com";
  const driveFileId = isDrive ? extractDriveFileId(parsed.toString()) : null;
  const driveFolderId = isDrive ? extractDriveFolderId(parsed.toString()) : null;

  if (driveOnly && !isDrive) {
    return {
      valid: false,
      url: null,
      isDrive: false,
      driveFileId: null,
      driveFolderId: null,
      error: "يُسمح فقط بروابط Google Drive",
    };
  }

  const isEduDomain = host.endsWith(".edu") || host.endsWith(".edu.ps") || host.endsWith(".ac.ps");
  if (!isDrive && (!allowTrustedExternal || (!TRUSTED_LINK_HOSTS.has(host) && !isEduDomain))) {
    return {
      valid: false,
      url: null,
      isDrive: false,
      driveFileId: null,
      driveFolderId: null,
      error:
        "النطاق غير مدعوم. يُرجى رفع الملف مباشرة أو استخدام رابط من Google Drive أو OneDrive أو Dropbox أو موقع جامعي (.edu.ps)",
    };
  }

  return {
    valid: true,
    url: parsed.toString(),
    isDrive,
    driveFileId,
    driveFolderId,
  };
}

/**
 * يحوّل رابط Google Drive (ملف أو مجلد مادة) إلى رابط معاينة آمن للـ iframe.
 * - للملفات: https://drive.google.com/file/d/{fileId}/preview
 * - للمجلدات: https://drive.google.com/embeddedfolderview?id={folderId}#list
 */
export function toDrivePreviewUrl(rawLink: string | null | undefined): string | null {
  if (!rawLink) return null;
  const check = validateLink(rawLink);
  if (!check.valid || !check.isDrive) return null;
  if (check.driveFileId) {
    return `https://drive.google.com/file/d/${encodeURIComponent(check.driveFileId)}/preview`;
  }
  if (check.driveFolderId) {
    return `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(check.driveFolderId)}#list`;
  }
  return null;
}

export function toSafeDownloadUrl(rawLink: string | null | undefined): {
  downloadUrl: string | null;
  viewUrl: string | null;
  isDrive: boolean;
  isFolder: boolean;
} {
  if (!rawLink) return { downloadUrl: null, viewUrl: null, isDrive: false, isFolder: false };
  const check = validateLink(rawLink);
  if (!check.valid || !check.url) return { downloadUrl: null, viewUrl: null, isDrive: false, isFolder: false };
  if (check.isDrive && check.driveFileId) {
    const id = encodeURIComponent(check.driveFileId);
    return {
      downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
      viewUrl: `https://drive.google.com/file/d/${id}/view`,
      isDrive: true,
      isFolder: false,
    };
  }
  if (check.isDrive && check.driveFolderId) {
    const id = encodeURIComponent(check.driveFolderId);
    const folderUrl = `https://drive.google.com/drive/folders/${id}`;
    return {
      downloadUrl: folderUrl,
      viewUrl: folderUrl,
      isDrive: true,
      isFolder: true,
    };
  }
  return {
    downloadUrl: check.url,
    viewUrl: check.url,
    isDrive: false,
    isFolder: false,
  };
}

export function validateMaterialInput(input: {
  title_ar?: unknown;
  description_ar?: unknown;
  type?: unknown;
  semester?: unknown;
  academic_year?: unknown;
  requireType?: boolean;
}): {
  valid: boolean;
  error?: string;
  title_ar: string;
  description_ar: string | null;
  type: MaterialType | null;
  semester: string | null;
  academic_year: string | null;
} {
  const title = typeof input.title_ar === "string" ? input.title_ar.trim() : "";
  if (!title) {
    return { valid: false, error: "عنوان المادة مطلوب", title_ar: "", description_ar: null, type: null, semester: null, academic_year: null };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      error: `عنوان المادة يجب ألا يتجاوز ${MAX_TITLE_LENGTH} حرفًا`,
      title_ar: "",
      description_ar: null,
      type: null,
      semester: null,
      academic_year: null,
    };
  }

  const desc = typeof input.description_ar === "string" ? input.description_ar.trim() : "";
  if (desc.length > MAX_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      error: `الوصف يجب ألا يتجاوز ${MAX_DESCRIPTION_LENGTH} حرفًا`,
      title_ar: "",
      description_ar: null,
      type: null,
      semester: null,
      academic_year: null,
    };
  }

  let type: MaterialType | null = null;
  if (input.requireType !== false) {
    if (typeof input.type !== "string" || !ALLOWED_MATERIAL_TYPES.has(input.type as MaterialType)) {
      return { valid: false, error: "نوع المادة غير صالح", title_ar: "", description_ar: null, type: null, semester: null, academic_year: null };
    }
    type = input.type as MaterialType;
  }

  const sem = typeof input.semester === "string" ? input.semester.trim() : "";
  if (sem && !ALLOWED_SEMESTERS.has(sem)) {
    return {
      valid: false,
      error: "قيمة الفصل الدراسي غير صالحة (يجب اختيار الفصل الأول أو الثاني أو الصيفي)",
      title_ar: "",
      description_ar: null,
      type: null,
      semester: null,
      academic_year: null,
    };
  }

  const year = typeof input.academic_year === "string" ? input.academic_year.trim() : "";
  if (year.length > MAX_ACADEMIC_YEAR_LENGTH) {
    return {
      valid: false,
      error: "صيغة العام الدراسي طويلة جدًا",
      title_ar: "",
      description_ar: null,
      type: null,
      semester: null,
      academic_year: null,
    };
  }

  return {
    valid: true,
    title_ar: title,
    description_ar: desc || null,
    type,
    semester: sem || null,
    academic_year: year || null,
  };
}
