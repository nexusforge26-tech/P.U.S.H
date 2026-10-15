"use client";

import { incrementDownloads } from "@/lib/data";
import { toSafeDownloadUrl } from "@/lib/validation";

export default function DownloadButton({
  materialId,
  driveLink,
}: {
  materialId: string;
  driveLink: string;
}) {
  const { downloadUrl, viewUrl, isDrive } = toSafeDownloadUrl(driveLink);

  if (!downloadUrl || !viewUrl) {
    return null;
  }

  const recordDownload = () => {
    incrementDownloads(materialId).catch(() => {});
  };

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <a
        href={downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={recordDownload}
        className="inline-flex items-center gap-2 rounded-full bg-clay px-6 py-3 text-sm font-bold text-parchment shadow-card transition-colors hover:bg-clay-dark"
      >
        <span>{isDrive ? "تنزيل الملف مباشرة" : "فتح وتنزيل المرجع"}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>

      {isDrive && (
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={recordDownload}
          className="inline-flex items-center gap-2 rounded-full border border-olive/15 bg-white px-5 py-3 text-sm font-bold text-olive-dark shadow-sm transition-colors hover:bg-olive/5"
        >
          <span>فتح في Google Drive</span>
          <span>↗</span>
        </a>
      )}
    </div>
  );
}
