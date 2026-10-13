"use client";

import Link from "next/link";
import { useBookmarks } from "@/lib/bookmarks";

export default function BookmarksHeaderButton() {
  const { mounted, totalCount } = useBookmarks();

  return (
    <Link
      href="/bookmarks"
      title="مقرراتي ومحفوظاتي الدراسية"
      className="relative flex h-11 items-center gap-2 rounded-2xl border border-olive/15 bg-white/70 px-3.5 text-xs font-bold text-olive-dark shadow-sm transition hover:bg-white hover:text-clay"
    >
      <span className="text-sm">📌</span>
      <span className="hidden sm:inline">محفوظاتي</span>
      {mounted && totalCount > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-black text-olive-dark shadow-xs animate-pulse">
          {totalCount}
        </span>
      )}
    </Link>
  );
}
