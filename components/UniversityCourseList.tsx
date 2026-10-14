"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

interface Item { id: string; name_ar: string; code: string | null }

// قائمة مساقات الجامعة مع بحث فوري بالاسم أو الرقم.
export default function UniversityCourseList({ universityId, courses }: { universityId: string; courses: Item[] }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return courses;
    return courses.filter((c) => c.name_ar.toLowerCase().includes(t) || (c.code ?? "").toLowerCase().includes(t));
  }, [q, courses]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ابحث عن مساق بالاسم أو الرقم..."
        className="mb-5 w-full rounded-2xl border border-olive/10 bg-white px-4 py-3.5 text-sm text-ink shadow-card outline-none focus:border-gold"
      />
      {list.length === 0 && (
        <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
          <h2 className="font-display text-2xl font-bold text-olive-dark">
            {courses.length === 0 ? "لا توجد مساقات مضافة بعد لهذه الجامعة" : "لا يوجد مساق مطابق للبحث"}
          </h2>
          <Link href="/submit/course" className="mt-3 inline-block text-sm font-bold text-clay hover:underline">اقترح مساقًا جديدًا</Link>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/universities/${universityId}/${c.id}`}
            className="group flex items-center justify-between rounded-3xl border border-olive/10 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft"
          >
            <span>
              <span className="block font-display text-lg font-bold text-olive-dark">{c.name_ar}</span>
              <span className="mt-1 block text-xs font-bold text-ink/40">{c.code || "بدون رمز"}</span>
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive/5 text-olive transition group-hover:bg-olive group-hover:text-parchment">←</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
