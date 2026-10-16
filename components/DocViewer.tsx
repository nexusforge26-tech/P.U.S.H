"use client";

import { useState, useEffect } from "react";
import type { Material } from "@/lib/types";

interface DocViewerProps {
  material: Material;
  className?: string;
}

export default function DocViewer({ material, className = "" }: DocViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [metaResolved, setMetaResolved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [useDirectStream, setUseDirectStream] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // نستعلم دائماً من السيرفر (/api/dl/[id]?mode=meta) للتحقق من وجود الملف،
  // وفك روابط المجلدات الفرعية، وتطبيق صلاحية القراءة العامة (ensureFilePublicReader) قبل عرض المعاينة
  useEffect(() => {
    if (!material.id) return;

    let cancelled = false;
    setIsLoading(true);
    setMetaResolved(false);
    setErrorMsg(null);

    fetch(`/api/dl/${encodeURIComponent(material.id)}?mode=meta`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;

        if (r.ok && data?.accessible && data?.previewUrl) {
          setPreviewUrl(data.previewUrl);
          setStreamUrl(data.streamUrl || null);
          setErrorMsg(null);
        } else {
          setPreviewUrl(null);
          setStreamUrl(null);
          setErrorMsg(
            data?.error ||
              "تعذر الوصول إلى هذا الملف؛ قد يكون الرابط الأصلي مقفلاً أو محذوفاً من المصدر."
          );
          setIsLoading(false);
        }
        setMetaResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setErrorMsg("تعذر الاتصال بالسيرفر لتجهيز معاينة الملف.");
        setIsLoading(false);
        setMetaResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [material.id, material.drive_link]);

  // إغلاق وضع ملء الشاشة عند الضغط على ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const activeIframeSrc = useDirectStream && streamUrl ? streamUrl : previewUrl;

  return (
    <div
      className={`group/viewer relative transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-50 flex h-screen w-screen flex-col bg-slate-950 p-2 sm:p-4"
          : `flex flex-col rounded-3xl border border-olive/15 bg-white shadow-soft ${className}`
      }`}
    >
      {/* شريط أدوات المعاينة داخل الموقع */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6 ${
          isFullscreen
            ? "mb-2 rounded-2xl border-white/10 bg-slate-900/90 text-white"
            : "rounded-t-3xl border-olive/10 bg-[#fbf9f4] text-olive-dark"
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-olive text-parchment shadow-sm">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold sm:text-base">{material.title_ar}</h3>
            <p className="truncate text-[11px] opacity-60">
              {material.course_name ? `${material.course_name} · ` : ""}
              المعاينة المدمجة داخل الموقع
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {streamUrl && !errorMsg && (
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setUseDirectStream((prev) => !prev);
              }}
              title="التبديل بين عارض Google Drive والبث المباشر من السيرفر في حال حظر ملفات تعريف الارتباط"
              className={`flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
                isFullscreen
                  ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                  : "border-olive/20 bg-white text-olive-dark hover:bg-olive/5"
              }`}
            >
              <span>{useDirectStream ? "عارض Drive" : "بث مباشر بديل"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? "إنهاء ملء الشاشة (ESC)" : "ملء الشاشة"}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-olive px-3 text-xs font-bold text-parchment shadow-sm transition hover:bg-olive-dark"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              )}
            </svg>
            <span className="hidden sm:inline">{isFullscreen ? "تصغير" : "ملء الشاشة"}</span>
          </button>
        </div>
      </div>

      {/* منطقة عرض المستند داخل الموقع */}
      <div
        className={`relative flex-1 overflow-hidden bg-[#f2efe9] ${
          isFullscreen ? "rounded-xl" : "rounded-b-3xl"
        }`}
        style={{ minHeight: isFullscreen ? "calc(100vh - 80px)" : "620px" }}
      >
        {isLoading && !errorMsg && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/75 backdrop-blur-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-olive/20 border-t-olive" />
            <p className="text-xs font-bold text-olive-dark">جارٍ تجهيز وعرض الملف...</p>
          </div>
        )}

        {errorMsg ? (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center p-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clay/10 text-2xl text-clay-dark">
              ⚠️
            </span>
            <h4 className="mt-4 font-display text-lg font-bold text-olive-dark">
              الملف غير متاح للعرض حالياً
            </h4>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-ink/65 sm:text-sm">
              {errorMsg}
            </p>
          </div>
        ) : (
          metaResolved &&
          activeIframeSrc && (
            <>
              {/* حاجز شفاف أعلى زاوية العارض لمنع زر الفتح الخارجي (Pop-out) الداخلي الخاص بـ Google Drive */}
              <div
                aria-hidden="true"
                className="absolute right-0 top-0 z-20 h-14 w-16"
                title={material.title_ar}
              />

              <iframe
                key={activeIframeSrc}
                title={material.title_ar}
                src={activeIframeSrc}
                onLoad={() => setIsLoading(false)}
                className="h-full min-h-[620px] w-full border-0"
                allow="autoplay; fullscreen"
                sandbox="allow-scripts allow-same-origin"
              />
            </>
          )
        )}
      </div>
    </div>
  );
}
