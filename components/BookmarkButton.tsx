"use client";

import { useState } from "react";
import { useBookmarks } from "@/lib/bookmarks";
import type { Material } from "@/lib/types";

interface BookmarkButtonProps {
  material: Material | { id: string; title_ar: string; course_name?: string; university_name?: string; faculty_name?: string; type: string; drive_link?: string | null; downloads_count?: number };
  variant?: "icon" | "full" | "toolbar";
  className?: string;
}

export default function BookmarkButton({
  material,
  variant = "icon",
  className = "",
}: BookmarkButtonProps) {
  const { mounted, isMaterialSaved, toggleMaterial } = useBookmarks();
  const [animating, setAnimating] = useState(false);

  const saved = mounted ? isMaterialSaved(material.id) : false;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnimating(true);
    toggleMaterial(material as any);
    setTimeout(() => setAnimating(false), 400);
  };

  if (variant === "toolbar") {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={saved ? "إزالة من المفضلة" : "حفظ المادة في المفضلة"}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
          saved
            ? "bg-gold text-olive-dark shadow-sm"
            : "bg-white/10 text-white hover:bg-white/20"
        } ${className}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 transition-transform duration-300 ${
            animating ? "scale-125" : ""
          }`}
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <span>{saved ? "محفوظ بالمفضلة" : "حفظ المادة"}</span>
      </button>
    );
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition shadow-card ${
          saved
            ? "bg-gold text-olive-dark hover:bg-gold-light"
            : "border border-olive/15 bg-white text-olive-dark hover:border-gold hover:bg-olive/5"
        } ${className}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 transition-transform duration-300 ${
            animating ? "scale-125 rotate-12" : ""
          }`}
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <span>{saved ? "في قائمة المفضلة" : "إضافة إلى المفضلة"}</span>
      </button>
    );
  }

  // Variant = "icon" (for cards)
  return (
    <button
      type="button"
      aria-label={saved ? "إزالة من المفضلة" : "حفظ في المفضلة"}
      title={saved ? "إزالة من المفضلة" : "حفظ في المفضلة"}
      onClick={handleClick}
      className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-xl backdrop-blur-md transition-all duration-200 ${
        saved
          ? "bg-gold text-olive-dark shadow-md ring-2 ring-gold/40 scale-105"
          : "bg-black/35 text-white/85 hover:bg-black/55 hover:text-white"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-4 w-4 transition-transform duration-300 ${
          animating ? "scale-130" : ""
        }`}
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
