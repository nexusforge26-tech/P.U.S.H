"use client";

export default function DownloadButton({
  materialId,
  driveLink,
}: {
  materialId: string;
  driveLink: string;
}) {
  if (!driveLink) {
    return null;
  }

  // رابط التنزيل المباشر عبر السيرفر (/api/dl/[id]) ينزّل الملف فورًا على الجهاز دون فتح Google Drive
  const directDownloadHref = `/api/dl/${encodeURIComponent(materialId)}`;

  return (
    <a
      href={directDownloadHref}
      download
      className="inline-flex items-center gap-2 rounded-full bg-clay px-6 py-3 text-sm font-bold text-parchment shadow-card transition-colors hover:bg-clay-dark"
    >
      <span>تنزيل الملف</span>
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path
          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
