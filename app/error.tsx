"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-clay/10 text-3xl text-clay">
        ⚠️
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold text-olive-dark">
        حدث خطأ غير متوقع أثناء تحميل الصفحة
      </h1>
      <p className="mt-3 text-sm leading-7 text-ink/60">
        نعتذر عن هذا الخلل المؤقت. يمكنك إعادة المحاولة الآن أو العودة إلى الصفحة الرئيسية.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-clay px-6 py-3 text-sm font-bold text-parchment shadow-card transition hover:bg-clay-dark"
        >
          إعادة المحاولة
        </button>
        <Link
          href="/"
          className="rounded-full border border-olive/15 bg-white px-6 py-3 text-sm font-bold text-olive-dark transition hover:bg-olive/5"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
