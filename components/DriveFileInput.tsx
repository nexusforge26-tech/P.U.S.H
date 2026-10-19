"use client";

import { useRef, useState } from "react";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  formatBytes,
  validateUploadFileMeta,
} from "@/lib/uploadLimits";
import { validateLink } from "@/lib/validation";
import { authFetch } from "@/lib/authFetch";
import { FILE_INPUT_CLASS, INPUT_CLASS } from "@/lib/styles";

// يجب أن يكون مضاعفًا لـ 256KB (شرط Google للرفع القابل للاستئناف).
const CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_RETRIES = 8;
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000; // 5 أيام

export interface UploadedFileMetadata {
  link: string;
  fileName: string;
  fileSize?: number | null;
  mimeType?: string | null;
}

interface Props {
  token?: string;
  currentLink?: string;
  currentName?: string;
  onUploaded: (link: string, fileName: string, meta?: UploadedFileMetadata) => void;
}

type DriveFile = { id?: string; name?: string; webViewLink?: string };
type PutResult = { status: number; range: string | null; body: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getStorageKey(file: File): string {
  return `push_upload_session_${file.name}_${file.size}_${file.lastModified}`;
}

function getSavedSessionUrl(file: File): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getStorageKey(file));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sessionUrl?: string; savedAt?: number };
    if (!parsed.sessionUrl || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      localStorage.removeItem(getStorageKey(file));
      return null;
    }
    return parsed.sessionUrl;
  } catch {
    return null;
  }
}

function saveSessionUrl(file: File, sessionUrl: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getStorageKey(file),
      JSON.stringify({ sessionUrl, savedAt: Date.now() })
    );
  } catch {
    // تجاهل امتلاء localStorage
  }
}

function clearSavedSessionUrl(file: File) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getStorageKey(file));
  } catch {
    // تجاهل
  }
}

function putToSession(
  url: string,
  body: Blob | null,
  contentRange: string,
  onBytes?: (loaded: number) => void,
  signal?: { aborted: boolean }
): Promise<PutResult> {
  return new Promise((resolve, reject) => {
    if (!url.startsWith("https://www.googleapis.com/upload/drive/")) {
      reject(new Error("رابط الرفع غير موثوق"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", contentRange);
    if (onBytes) xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () =>
      resolve({
        status: xhr.status,
        range: xhr.getResponseHeader("Range"),
        body: xhr.responseText,
      });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    if (signal?.aborted) return reject(new Error("aborted"));
    xhr.send(body);
  });
}

// يحوّل رفض Google Drive (مثل 403) إلى سبب مفهوم بدل رقم الخطأ فقط
function explainDriveRejection(status: number, body: string): string {
  let reason = "";
  try {
    const parsed = JSON.parse(body);
    reason = String(parsed?.error?.errors?.[0]?.reason || parsed?.error?.status || "");
  } catch {
    // الرد ليس JSON
  }
  if (/storageQuota/i.test(reason)) {
    return "مساحة التخزين في Google Drive ممتلئة أو حساب الرفع لا يملك مساحة. تواصل مع الإدارة لتفريغ المساحة (ومنها سلة المحذوفات).";
  }
  if (/rateLimit|quotaExceeded|dailyLimit/i.test(reason)) {
    return "تجاوز Google Drive حد الطلبات مؤقتًا، حاول بعد دقائق.";
  }
  if (/insufficientFilePermissions|forbidden|PERMISSION_DENIED/i.test(reason) || status === 403) {
    return `لا يملك حساب الرفع صلاحية الكتابة في مجلد الموقع على Google Drive (${status}${reason ? ` · ${reason}` : ""}). أبلغ الإدارة.`;
  }
  return `Google Drive رفض الرفع (${status})`;
}

function parseDone(body: string): DriveFile {
  try {
    return JSON.parse(body) as DriveFile;
  } catch {
    return {};
  }
}

async function queryProgress(
  url: string,
  size: number
): Promise<{ done?: DriveFile; offset: number }> {
  const r = await putToSession(url, null, `bytes */${size}`);
  if (r.status === 200 || r.status === 201) {
    return { done: parseDone(r.body), offset: size };
  }
  if (r.status === 308) {
    const m = r.range?.match(/bytes=0-(\d+)/);
    return { offset: m ? Number(m[1]) + 1 : 0 };
  }
  throw new Error(`Google Drive (${r.status})`);
}

async function uploadToGoogle(
  sessionUrl: string,
  file: File,
  initialOffset: number,
  onProgress: (v: number) => void
): Promise<DriveFile> {
  const size = file.size;
  let offset = initialOffset;
  let failures = 0;

  while (offset < size) {
    const end = Math.min(offset + CHUNK_SIZE, size);
    try {
      const r = await putToSession(
        sessionUrl,
        file.slice(offset, end),
        `bytes ${offset}-${end - 1}/${size}`,
        (loaded) => onProgress(Math.min(99, Math.round(((offset + loaded) / size) * 100)))
      );

      if (r.status === 200 || r.status === 201) {
        onProgress(100);
        return parseDone(r.body);
      }
      if (r.status === 308) {
        const m = r.range?.match(/bytes=0-(\d+)/);
        offset = m ? Number(m[1]) + 1 : end;
        failures = 0;
        onProgress(Math.min(99, Math.round((offset / size) * 100)));
        continue;
      }
      if (r.status >= 500 || r.status === 429) throw new Error("retry");
      if (r.status === 404) {
        clearSavedSessionUrl(file);
        throw new Error("انتهت صلاحية جلسة الرفع، يرجى اختيار الملف مرة أخرى للبدء من جديد");
      }
      throw new Error(explainDriveRejection(r.status, r.body));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      const retryable = msg === "network" || msg === "retry";
      if (!retryable || ++failures > MAX_RETRIES) {
        throw retryable
          ? new Error("انقطع الاتصال أثناء الرفع، يمكنك إعادة اختيار نفس الملف لاستئناف الرفع من حيث توقف.")
          : err;
      }
      await sleep(Math.min(1000 * 2 ** failures, 15000));
      try {
        const st = await queryProgress(sessionUrl, size);
        if (st.done) {
          onProgress(100);
          return st.done;
        }
        offset = st.offset;
      } catch {
        // نعيد المحاولة من نفس الموضع
      }
    }
  }
  throw new Error("لم يُرجع Google Drive نتيجة نهائية للرفع");
}

const ACCEPT_ATTR = Array.from(ALLOWED_UPLOAD_EXTENSIONS)
  .map((ext) => `.${ext}`)
  .join(",");

export default function DriveFileInput({ currentLink, currentName, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [resumedFromPercent, setResumedFromPercent] = useState<number | null>(null);
  const [fileInfo, setFileInfo] = useState("");
  const [uploadedName, setUploadedName] = useState(currentName || "");
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError("");
    setProgress(0);
    setResumedFromPercent(null);
    setFileInfo(`${file.name} · ${formatBytes(file.size)}`);

    try {
      const fileCheck = validateUploadFileMeta(file.name, file.type, file.size);
      if (!fileCheck.valid) {
        throw new Error(fileCheck.error || "نوع أو حجم الملف غير مسموح به");
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `حجم الملف (${formatBytes(file.size)}) أكبر من الحد المسموح به (${MAX_UPLOAD_LABEL})`
        );
      }

      // محاولة استئناف جلسة رفع سابقة محفوظة في localStorage لنفس الملف (الاسم + الحجم + تاريخ التعديل)
      let sessionUrl = getSavedSessionUrl(file);
      let startOffset = 0;
      let alreadyDone: DriveFile | undefined;

      if (sessionUrl) {
        try {
          const st = await queryProgress(sessionUrl, file.size);
          if (st.done?.id) {
            alreadyDone = st.done;
          } else if (st.offset > 0 && st.offset < file.size) {
            startOffset = st.offset;
            const pct = Math.round((startOffset / file.size) * 100);
            setProgress(pct);
            setResumedFromPercent(pct);
          }
        } catch {
          clearSavedSessionUrl(file);
          sessionUrl = null;
        }
      }

      // إذا لم تكن هناك جلسة سابقة صالحة، ننشئ جلسة جديدة من السيرفر
      if (!sessionUrl) {
        const init = await authFetch("/api/upload/drive/initiate", {
          method: "POST",
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSize: file.size,
          }),
        });
        const initData = await init.json().catch(() => ({}));
        if (!init.ok || !initData.sessionUrl) {
          throw new Error(initData.error || "تعذر بدء الرفع إلى Google Drive");
        }
        sessionUrl = String(initData.sessionUrl);
        saveSessionUrl(file, sessionUrl);
      }

      const uploaded =
        alreadyDone ?? (await uploadToGoogle(sessionUrl, file, startOffset, setProgress));
      if (!uploaded.id) throw new Error("لم يُرجع Google Drive معرّف الملف");

      const fin = await authFetch("/api/upload/drive/finalize", {
        method: "POST",
        body: JSON.stringify({ fileId: uploaded.id, fileName: file.name }),
      });
      const finData = await fin.json().catch(() => ({}));
      if (!fin.ok || !finData.drive_link) {
        throw new Error(finData.error || "تم الرفع لكن تعذر تجهيز رابط الملف");
      }

      clearSavedSessionUrl(file);
      setPasted("");
      const finalName = finData.file_name || file.name;
      setUploadedName(finalName);
      onUploaded(finData.drive_link, finalName, {
        link: finData.drive_link,
        fileName: finalName,
        fileSize: finData.file_size ?? file.size,
        mimeType: finData.mime_type ?? file.type,
      });
      setProgress(100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "تعذر الاتصال أثناء الرفع");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handlePasteChange(rawVal: string) {
    setPasted(rawVal);
    const trimmed = rawVal.trim();
    if (!trimmed) {
      setError("");
      onUploaded("", "");
      return;
    }
    const check = validateLink(trimmed);
    if (!check.valid || !check.url) {
      setError(check.error || "الرابط غير صالح");
      onUploaded("", "");
      return;
    }
    setError("");
    onUploaded(check.url, "");
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={handleFile}
        disabled={busy}
        className={FILE_INPUT_CLASS}
      />
      <p className="text-[11px] font-bold text-ink/45">
        الأنواع المسموحة: PDF، Word، PowerPoint، Excel، الصور، والملفات المضغوطة (ZIP/RAR) حتى{" "}
        {MAX_UPLOAD_LABEL}. يدعم استئناف الرفع تلقائيًا عند انقطاع الاتصال.
      </p>
      <input
        type="url"
        dir="ltr"
        value={pasted}
        onChange={(e) => handlePasteChange(e.target.value)}
        disabled={busy}
        placeholder="أو الصق رابط ملف آمن (https://drive.google.com/...)"
        className={INPUT_CLASS}
      />
      {busy && (
        <div className="space-y-1">
          <p className="text-xs font-bold text-olive-dark">
            جارٍ رفع الملف... {progress}%{" "}
            {resumedFromPercent !== null && (
              <span className="text-clay">(تم الاستئناف من {resumedFromPercent}%) </span>
            )}
            <span className="font-normal text-ink/45" dir="ltr">
              {fileInfo}
            </span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-olive/10">
            <div
              className="h-full rounded-full bg-clay transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-ink/45">
            إذا أُغلقت الصفحة عن طريق الخطأ، اختر نفس الملف مرة أخرى وسيُستأنف الرفع من حيث توقف.
          </p>
        </div>
      )}
      {error && <p className="text-xs font-bold text-clay-dark">{error}</p>}
      {!busy && !error && !pasted && (currentLink || uploadedName) && (
        <p className="rounded-xl bg-olive/5 px-3 py-2 text-xs font-bold text-olive-dark">
          تم تجهيز الملف{uploadedName ? `: ${uploadedName}` : ""} ✓
          {currentLink && (
            <a
              href={currentLink}
              target="_blank"
              rel="noreferrer"
              className="mr-2 text-clay hover:underline"
            >
              عرض الملف ←
            </a>
          )}
        </p>
      )}
    </div>
  );
}
