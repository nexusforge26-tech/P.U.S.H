import type { MaterialType } from "@/lib/types";

export default function TypeIcon({
  type,
  className = "h-5 w-5",
}: {
  type: MaterialType;
  className?: string;
}) {
  switch (type) {
    case "exam":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M8 3.5h6.5L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1-1.5z" strokeLinejoin="round" />
          <path d="M14 3.5V8h5" strokeLinejoin="round" />
          <path d="m9.75 13.25 1.75 1.75 3-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "summary":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M12 6.5c-1.4-1-3.6-1.5-5.5-1.5-.6 0-1 .4-1 1v11c0 .6.4 1 1 1 1.9 0 4.1.5 5.5 1.5 1.4-1 3.6-1.5 5.5-1.5.6 0 1-.4 1-1V6c0-.6-.4-1-1-1-1.9 0-4.1.5-5.5 1.5z" strokeLinejoin="round" />
          <path d="M12 6.5V19" strokeLinecap="round" />
        </svg>
      );
    case "video":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <rect x="3" y="5.5" width="14" height="13" rx="2" strokeLinejoin="round" />
          <path d="m21 8.5-4 2.5v2l4 2.5v-7z" strokeLinejoin="round" />
        </svg>
      );
    case "file":
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z" strokeLinejoin="round" />
          <path d="M14 3.5V7a1 1 0 0 0 1 1h3.2" strokeLinejoin="round" />
          <path d="M9 13h6M9 16h6" strokeLinecap="round" />
        </svg>
      );
  }
}
