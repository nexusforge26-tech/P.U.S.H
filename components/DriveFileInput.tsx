"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

const input = "w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none file:ml-3 file:rounded-xl file:border-0 file:bg-olive file:px-4 file:py-2 file:font-black file:text-parchment focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB; Google requires resumable chunks to be multiples of 256KB.

interface Props {
  token: string;
  currentLink?: string;
  currentName?: string;
  onUploaded: (link: string, fileName: string) => void;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadToGoogle(sessionUrl: string, file: File, onProgress: (value: number) => void) {
  let start = 0;

  while (start < file.size) {
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    let completed = false;

    for (let attempt = 0; attempt < 3 && !completed; attempt++) {
      try {
        const response = await fetch(sessionUrl, {
          method: "PUT",
          headers: {
            "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
          },
          body: chunk,
        });

        if (response.status === 308) {
          const range = response.headers.get("Range");
          const match = range?.match(/bytes=0-(\d+)/);
          start = match ? Number(match[1]) + 1 : end;
          onProgress(Math.min(100, Math.round((start / file.size) * 100)));
          completed = true;
          continue;
        }

        if (response.ok) {
          const data = await response.json();
          onProgress(100);
          return data as { id?: string; name?: string; webViewLink?: string };
        }

        const text = await response.text().catch(() => "");
        throw new Error(`Google Drive رفض جزء الرفع (${response.status})${text ? `: ${text}` : ""}`);
      } catch (error) {
        if (attempt === 2) throw error;
        await sleep(800 * (attempt + 1));
      }
    }
  }

  throw new Error("لم يُرجع Google Drive نتيجة نهائية للرفع");
}

export default function DriveFileInput({ token, currentLink, currentName, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploadedName, setUploadedName] = useState(currentName || "");
  const [pasted, setPasted] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError("");
    setProgress(0);

    try {
      if (file.size === 0) throw new Error("الملف فارغ");
      if (file.size > MAX_FILE_SIZE) throw new Error("حجم الملف أكبر من الحد المسموح به (25 ميجابايت)");
      if (!token) throw new Error("انتهت جلسة تسجيل الدخول، يرجى تسجيل الدخول مرة أخرى");

      // الرفع إلى Supabase Storage: طلب صغير للسيرفر ثم رفع مباشر من المتصفح.
      const init = await fetch("/api/upload/storage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
      });
      const initData = await init.json().catch(() => ({}));
      if (!init.ok || !initData.token) throw new Error(initData.error || "تعذر بدء الرفع");

      setProgress(30);
      const { error: upErr } = await supabase.storage
        .from(initData.bucket)
        .uploadToSignedUrl(initData.path, initData.token, file, { contentType: file.type || "application/octet-stream" });
      if (upErr) throw new Error(upErr.message || "فشل رفع الملف");

      const finalData = { file_name: file.name, drive_link: initData.publicUrl as string };

      setPasted("");
      setUploadedName(finalData.file_name || file.name);
      onUploaded(finalData.drive_link, finalData.file_name || file.name);
      setProgress(100);
    } catch (err: any) {
      setError(err?.message || "تعذر الاتصال بالخادم أثناء الرفع");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" onChange={handleFile} disabled={busy} className={input} />
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
          <p className="text-xs font-bold text-olive-dark">جارٍ رفع الملف... {progress}%</p>
          <div className="h-2 overflow-hidden rounded-full bg-olive/10">
            <div className="h-full rounded-full bg-clay transition-all" style={{ width: `${progress}%` }} />
          </div>
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
