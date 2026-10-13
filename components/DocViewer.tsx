"use client";

import { useState, useRef, useEffect } from "react";
import BookmarkButton from "./BookmarkButton";
import type { Material } from "@/lib/types";

interface DocViewerProps {
  material: Material;
  className?: string;
}

export default function DocViewer({ material, className = "" }: DocViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize Drive / PDF Link for optimal embedding
  const rawLink = material.drive_link || "";
  let embedUrl = rawLink;

  if (rawLink.includes("drive.google.com")) {
    embedUrl = rawLink
      .replace(/\/view(?:\?.*)?$/i, "/preview")
      .replace(/\/edit(?:\?.*)?$/i, "/preview");
    if (!embedUrl.endsWith("/preview") && !embedUrl.includes("/preview?")) {
      embedUrl = embedUrl.replace(/\?usp=sharing.*$/, "/preview");
    }
  }

  // Handle ESC key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const zoomIn = () => setZoomLevel((z) => Math.min(z + 15, 175));
  const zoomOut = () => setZoomLevel((z) => Math.max(z - 15, 70));
  const resetZoom = () => setZoomLevel(100);

  const handlePrint = () => {
    window.open(rawLink, "_blank");
  };

  return (
    <div
      ref={containerRef}
      className={`group/viewer relative transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-50 flex h-screen w-screen flex-col bg-slate-950 p-2 sm:p-4"
          : `flex flex-col rounded-3xl border border-olive/15 bg-white shadow-soft ${className}`
      }`}
    >
      {/* Viewer Header / Toolbar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 ${
          isFullscreen
            ? "border-white/10 bg-slate-900/90 text-white rounded-2xl mb-2"
            : "border-olive/10 bg-[#fbf9f4] text-olive-dark rounded-t-3xl"
        }`}
      >
        {/* Title & Document Badge */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-olive text-parchment shadow-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold sm:text-base">
              {material.title_ar}
            </h3>
            <p className="truncate text-[11px] opacity-60">
              {material.course_name ? `${material.course_name} · ` : ""}
              عارض المستندات المدمج
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Zoom Controls */}
          <div className="hidden items-center rounded-xl border border-black/10 bg-black/5 p-0.5 sm:flex">
            <button
              type="button"
              onClick={zoomOut}
              title="تصغير"
              disabled={zoomLevel <= 70}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition hover:bg-white/80 disabled:opacity-40"
            >
              -
            </button>
            <button
              type="button"
              onClick={resetZoom}
              title="إعادة ضبط الحجم"
              className="px-2 text-[11px] font-bold"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              title="تكبير"
              disabled={zoomLevel >= 175}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition hover:bg-white/80 disabled:opacity-40"
            >
              +
            </button>
          </div>

          {/* Reading / Contrast Mode */}
          <button
            type="button"
            onClick={() => setIsDarkMode((d) => !d)}
            title={isDarkMode ? "الوضع الطبيعي" : "وضع القراءة المريح"}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-black/5 transition hover:bg-black/10"
          >
            {isDarkMode ? "☀️" : "🌙"}
          </button>

          {/* Bookmark Button */}
          <BookmarkButton material={material} variant="toolbar" />

          {/* Open in new window */}
          {rawLink && (
            <a
              href={rawLink}
              target="_blank"
              rel="noopener noreferrer"
              title="فتح في نافذة مستقلة"
              className="hidden h-8 items-center gap-1.5 rounded-xl border border-black/10 bg-black/5 px-2.5 text-xs font-medium transition hover:bg-black/10 md:inline-flex"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              <span>نافذة جديدة</span>
            </a>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "إنهاء ملء الشاشة (ESC)" : "ملء الشاشة"}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-olive px-3 text-xs font-bold text-parchment shadow-sm transition hover:bg-olive-dark"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              {isFullscreen ? (
                <>
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </>
              ) : (
                <>
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </>
              )}
            </svg>
            <span className="hidden sm:inline">
              {isFullscreen ? "تصغير" : "ملء الشاشة"}
            </span>
          </button>
        </div>
      </div>

      {/* Viewer Main Viewport */}
      <div
        className={`relative flex-1 overflow-auto transition-colors duration-300 ${
          isDarkMode ? "bg-slate-900" : "bg-[#f2efe9]"
        } ${isFullscreen ? "rounded-xl" : "rounded-b-3xl"}`}
        style={{ minHeight: isFullscreen ? "calc(100vh - 80px)" : "620px" }}
      >
        {/* Loading Spinner */}
        {isLoading && !loadError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive/20 border-t-olive" />
            <p className="text-xs font-bold text-olive-dark">جاري تجهيز وعرض الملف...</p>
          </div>
        )}

        {/* Load Error Fallback */}
        {loadError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 text-center bg-white/95">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clay/10 text-clay mb-3">
              ⚠️
            </span>
            <h4 className="font-display text-lg font-bold text-olive-dark">
              تعذّر عرض المعاينة التلقائية في هذا المتصفح
            </h4>
            <p className="mt-1 max-w-md text-xs leading-5 text-ink/60">
              قد يكون إعداد أمان المتصفح يمنع معاينات معينة، يمكنك فتح الملف مباشرة أو تنزيله بكل سهولة.
            </p>
            <div className="mt-5 flex gap-3">
              {rawLink && (
                <a
                  href={rawLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-olive px-5 py-2.5 text-xs font-bold text-parchment shadow-sm hover:bg-olive-dark"
                >
                  فتح الملف مباشرة في Google Drive ↗
                </a>
              )}
            </div>
          </div>
        )}

        {/* Document Frame with Zoom scaling */}
        <div
          className="mx-auto flex h-full w-full items-center justify-center transition-transform duration-200"
          style={{
            transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
            transformOrigin: "top center",
          }}
        >
          {embedUrl ? (
            <iframe
              title={material.title_ar}
              src={embedUrl}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setLoadError(true);
              }}
              className="h-full min-h-[620px] w-full border-0"
              allow="autoplay; fullscreen"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="text-4xl">📄</span>
              <p className="mt-3 text-sm text-ink/60">لا يوجد رابط مستند متاح للعرض</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
