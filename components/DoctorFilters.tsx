"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getUniversities } from "@/lib/data";
import type { University } from "@/lib/types";
import { SELECT_CLASS } from "@/lib/styles";

export default function DoctorFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const universityId = sp.get("university") ?? "";
  const [term, setTerm] = useState(q);
  const [universities, setUniversities] = useState<University[]>([]);

  useEffect(() => {
    getUniversities()
      .then(setUniversities)
      .catch(() => setUniversities([]));
  }, []);

  function updateParam(key: string, value: string, reset: string[] = []) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    reset.forEach((k) => p.delete(k));
    router.push(`/doctors?${p.toString()}`);
  }

  return (
    <div className="rounded-[24px] border border-olive/10 bg-white/80 p-5 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <form
          className="flex gap-2 sm:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("q", term.trim());
          }}
        >
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="ابحث باسم الدكتور أو اسم المساق الذي يدرّسه..."
            className={SELECT_CLASS}
          />
          <button
            type="submit"
            className="shrink-0 rounded-2xl bg-clay px-5 py-3 text-sm font-bold text-parchment shadow-sm hover:bg-clay-dark"
          >
            بحث
          </button>
        </form>
        <select
          className={SELECT_CLASS}
          value={universityId}
          onChange={(e) => updateParam("university", e.target.value)}
        >
          <option value="">كل الجامعات</option>
          {universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name_ar}
            </option>
          ))}
        </select>
        {(q || universityId) && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              router.push("/doctors");
            }}
            className="rounded-2xl bg-clay/5 py-2.5 text-xs font-bold text-clay hover:bg-clay/10"
          >
            إعادة ضبط الفلاتر
          </button>
        )}
      </div>
    </div>
  );
}
