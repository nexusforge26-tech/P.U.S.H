"use client";
import Link from "next/link";
import { useState } from "react";
import { searchCourses, type CourseSearchResult } from "@/lib/data";

export default function CourseSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CourseSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setSearched(true);
    try {
      setResults(await searchCourses(q));
    } catch {
      setResults([]);
    }
    setBusy(false);
  }

  return (
    <div>
      <form onSubmit={submit} className="flex w-full gap-2 rounded-[22px] border border-olive/10 bg-white p-1.5 shadow-soft">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن اسم المساق أو رقمه..."
          className="w-full rounded-2xl bg-transparent py-3.5 px-4 text-sm text-ink placeholder:text-ink/35 focus:outline-none"
        />
        <button type="submit" disabled={busy} className="rounded-[17px] bg-clay px-5 text-sm font-bold text-parchment shadow-card transition hover:bg-clay-dark">
          {busy ? "جارٍ البحث..." : "بحث"}
        </button>
      </form>

      {searched && (
        <div className="mt-4 space-y-2">
          {results.length === 0 && !busy && (
            <div className="rounded-2xl border border-dashed border-olive/15 bg-white p-5 text-center text-sm text-ink/45">
              لا يوجد مساق مطابق للاسم أو الرقم المدخل.
            </div>
          )}
          {results.map((c) => (
            <Link
              key={c.id}
              href={`/universities/${c.university_id}/${c.faculty_id}/${c.id}`}
              className="flex items-center justify-between rounded-2xl border border-olive/10 bg-white p-4 shadow-card transition hover:border-gold/40"
            >
              <div>
                <p className="font-bold text-olive-dark">{c.name_ar}</p>
                <p className="mt-1 text-xs text-ink/45">{c.code} · {c.faculty_name} · {c.university_name}</p>
              </div>
              <span className="text-clay">←</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
