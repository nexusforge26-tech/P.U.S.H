"use client";

import { incrementDownloads } from "@/lib/data";

function toPreviewUrl(link: string) {
  const match = link.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([A-Za-z0-9_-]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return link;
}

export default function DownloadButton({
  materialId,
  driveLink,
}: {
  materialId: string;
  driveLink: string;
}) {
  const previewLink = driveLink.replace(/\/edit(?:\?.*)?$/i, "/preview").replace(/\/view(?:\?.*)?$/i, "/preview");
  return (
    <a
      href={previewLink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        incrementDownloads(materialId).catch(() => {});
      }}
      className="inline-flex items-center gap-2 rounded-full bg-clay px-6 py-3 text-sm font-medium text-parchment transition-colors hover:bg-clay-dark"
    >
      عرض الملف في المتصفح
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M14 3v2h3.59L9 13.59 10.41 15 19 6.41V10h2V3h-7zM5 5v14h14v-7h-2v5H7V7h5V5H5z" />
      </svg>
    </a>
  );
}
