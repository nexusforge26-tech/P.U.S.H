"use client";
import { useState } from "react";

const input = "w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none file:ml-3 file:rounded-xl file:border-0 file:bg-olive file:px-4 file:py-2 file:font-black file:text-parchment focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";

interface Props {
  token: string;
  currentLink?: string;
  currentName?: string;
  onUploaded: (link: string, fileName: string) => void;
}

// يرفع الملف مباشرة من جهاز المستخدم إلى Google Drive الخاص بالموقع (عبر
// /api/upload/drive)، ثم يعيد رابط Drive الناتج ليُخزَّن كـ drive_link.
export default function DriveFileInput({ token, currentLink, currentName, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadedName, setUploadedName] = useState(currentName || "");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/upload/drive", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "تعذر رفع الملف"); return; }
      setUploadedName(d.file_name || file.name);
      onUploaded(d.drive_link, d.file_name || file.name);
    } catch {
      setError("تعذر الاتصال بالخادم أثناء الرفع");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input type="file" onChange={handleFile} disabled={busy} className={input} />
      {busy && <p className="text-xs font-bold text-olive-dark">جارٍ رفع الملف إلى Google Drive...</p>}
      {error && <p className="text-xs font-bold text-clay-dark">{error}</p>}
      {!busy && !error && (currentLink || uploadedName) && (
        <p className="rounded-xl bg-olive/5 px-3 py-2 text-xs font-bold text-olive-dark">
          تم رفع الملف{uploadedName ? `: ${uploadedName}` : ""} ✓
          {currentLink && <a href={currentLink} target="_blank" rel="noreferrer" className="mr-2 text-clay hover:underline">عرض في Drive ←</a>}
        </p>
      )}
    </div>
  );
}
