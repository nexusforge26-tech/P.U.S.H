"use client";
import { useRef, useState } from "react";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, formatBytes } from "@/lib/uploadLimits";

const input = "w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none file:ml-3 file:rounded-xl file:border-0 file:bg-olive file:px-4 file:py-2 file:font-black file:text-parchment focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";
// يجب أن يكون مضاعفًا لـ 256KB (شرط Google للرفع القابل للاستئناف).
const CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_RETRIES = 8;

interface Props {
  token: string;
  currentLink?: string;
  currentName?: string;
  onUploaded: (link: string, fileName: string) => void;
}

type DriveFile = { id?: string; name?: string; webViewLink?: string };
type PutResult = { status: number; range: string | null; body: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// PUT مباشر إلى جلسة Google Drive. نستخدم XHR لأنه يعطي تقدّم الرفع الفعلي.
function putToSession(
  url: string,
  body: Blob | null,
  contentRange: string,
  onBytes?: (loaded: number) => void,
  signal?: { aborted: boolean },
): Promise<PutResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Range", contentRange);
    if (onBytes) xhr.upload.onprogress = (e) => onBytes(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader("Range"), body: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("network"));
    xhr.onabort = () => reject(new Error("aborted"));
    if (signal?.aborted) return reject(new Error("aborted"));
    xhr.send(body);
  });
}

function parseDone(body: string): DriveFile {
  try { return JSON.parse(body) as DriveFile; } catch { return {}; }
}

// يسأل Google كم بايت استلمت فعلًا (لاستئناف الرفع بعد انقطاع الاتصال).
async function queryProgress(url: string, size: number): Promise<{ done?: DriveFile; offset: number }> {
  const r = await putToSession(url, null, `bytes */${size}`);
  if (r.status === 200 || r.status === 201) return { done: parseDone(r.body), offset: size };
  if (r.status === 308) {
    const m = r.range?.match(/bytes=0-(\d+)/);
    return { offset: m ? Number(m[1]) + 1 : 0 };
  }
  throw new Error(`Google Drive (${r.status})`);
}

// رفع الملف بالكامل مباشرة من المتصفح إلى Google Drive على أجزاء، مع إعادة المحاولة والاستئناف.
async function uploadToGoogle(sessionUrl: string, file: File, onProgress: (v: number) => void): Promise<DriveFile> {
  const size = file.size;
  let offset = 0;
  let failures = 0;

  while (offset < size) {
    const end = Math.min(offset + CHUNK_SIZE, size);
    try {
      const r = await putToSession(
        sessionUrl,
        file.slice(offset, end),
        `bytes ${offset}-${end - 1}/${size}`,
        (loaded) => onProgress(Math.min(99, Math.round(((offset + loaded) / size) * 100))),
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
      if (r.status === 404) throw new Error("انتهت صلاحية جلسة الرفع، أعد المحاولة من البداية");
      throw new Error(`Google Drive رفض الرفع (${r.status})`);
    } catch (err: any) {
      const retryable = err?.message === "network" || err?.message === "retry";
      if (!retryable || ++failures > MAX_RETRIES) {
        throw retryable ? new Error("انقطع الاتصال أثناء الرفع، تحقق من الإنترنت وأعد المحاولة") : err;
      }
      await sleep(Math.min(1000 * 2 ** failures, 15000));
      try {
        const st = await queryProgress(sessionUrl, size);
        if (st.done) { onProgress(100); return st.done; }
        offset = st.offset;
      } catch { /* نعيد المحاولة من نفس الموضع */ }
    }
  }
  throw new Error("لم يُرجع Google Drive نتيجة نهائية للرفع");
}

export default function DriveFileInput({ token, currentLink, currentName, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
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
    setFileInfo(`${file.name} · ${formatBytes(file.size)}`);

    try {
      if (file.size === 0) throw new Error("الملف فارغ");
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(`حجم الملف (${formatBytes(file.size)}) أكبر من الحد المسموح به (${MAX_UPLOAD_LABEL})`);
      }
      if (!token) throw new Error("انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مرة أخرى");
      const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // 1) طلب صغير للسيرفر: إنشاء جلسة رفع في Google Drive (بدون ملف).
      const init = await fetch("/api/upload/drive/initiate", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ fileName: file.name, mimeType: file.type || "application/octet-stream", fileSize: file.size }),
      });
      const initData = await init.json().catch(() => ({}));
      if (!init.ok || !initData.sessionUrl) throw new Error(initData.error || "تعذر بدء الرفع إلى Google Drive");

      // 2) رفع الملف مباشرة من المتصفح إلى Google Drive — لا وسيط.
      const uploaded = await uploadToGoogle(initData.sessionUrl, file, setProgress);
      if (!uploaded.id) throw new Error("لم يُرجع Google Drive معرّف الملف");

      // 3) طلب صغير للسيرفر: جعل الملف قابلًا للعرض وإرجاع الرابط.
      const fin = await fetch("/api/upload/drive/finalize", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ fileId: uploaded.id, fileName: file.name }),
      });
      const finData = await fin.json().catch(() => ({}));
      if (!fin.ok || !finData.drive_link) throw new Error(finData.error || "تم الرفع لكن تعذر تجهيز رابط الملف");

      setPasted("");
      setUploadedName(finData.file_name || file.name);
      onUploaded(finData.drive_link, finData.file_name || file.name);
      setProgress(100);
    } catch (err: any) {
      setError(err?.message || "تعذر الاتصال أثناء الرفع");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" onChange={handleFile} disabled={busy} className={input} />
      <p className="text-[11px] font-bold text-ink/45">أي نوع ملف حتى {MAX_UPLOAD_LABEL}، يُرفع مباشرة إلى Google Drive.</p>
      <input
        type="url"
        dir="ltr"
        value={pasted}
        onChange={(e) => {
          setPasted(e.target.value);
          setError("");
          onUploaded(e.target.value.trim(), "");
        }}
        disabled={busy}
        placeholder="أو الصق رابط الملف (Google Drive / أي رابط عام)"
        className={input}
      />
      {busy && (
        <div className="space-y-1">
          <p className="text-xs font-bold text-olive-dark">جارٍ رفع الملف... {progress}% <span className="font-normal text-ink/45" dir="ltr">{fileInfo}</span></p>
          <div className="h-2 overflow-hidden rounded-full bg-olive/10">
            <div className="h-full rounded-full bg-clay transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] text-ink/45">لا تغلق الصفحة حتى يكتمل الرفع.</p>
        </div>
      )}
      {error && <p className="text-xs font-bold text-clay-dark">{error}</p>}
      {!busy && !error && !pasted && (currentLink || uploadedName) && (
        <p className="rounded-xl bg-olive/5 px-3 py-2 text-xs font-bold text-olive-dark">
          تم رفع الملف{uploadedName ? `: ${uploadedName}` : ""} ✓
          {currentLink && <a href={currentLink} target="_blank" rel="noreferrer" className="mr-2 text-clay hover:underline">عرض الملف ←</a>}
        </p>
      )}
    </div>
  );
}
