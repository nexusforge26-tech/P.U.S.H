"use client";

import { useRef } from "react";
import type { Material } from "@/lib/types";
import MaterialCard from "@/components/MaterialCard";

export default function MaterialCarousel({ items }: { items: Material[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 640) * direction;
    el.scrollBy({ left: amount, behavior: "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="snap-row scrollbar-thin flex gap-4 overflow-x-auto pb-3"
        dir="rtl"
      >
        {items.map((item) => (
          <div key={item.id} className="w-[78%] shrink-0 sm:w-[46%] lg:w-[30%]">
            <MaterialCard material={item} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="السابق"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-olive/25 bg-white/70 text-olive-dark transition-colors hover:bg-olive hover:text-parchment"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="M15.5 4.5 8 12l7.5 7.5 1.4-1.4L10.8 12l6.1-6.1z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="التالي"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-olive/25 bg-white/70 text-olive-dark transition-colors hover:bg-olive hover:text-parchment"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <path d="m8.5 4.5-1.4 1.4L13.2 12l-6.1 6.1 1.4 1.4L16 12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
