"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getFaculties, getUniversities } from "@/lib/data";
import type { Faculty, University } from "@/lib/types";

const input = "w-full rounded-2xl border border-olive/10 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-gold";

export default function DoctorFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const universityId = sp.get("university") ?? "";
  const facultyId = sp.get("faculty") ?? "";
  const [term, setTerm] = useState(q);
  const [universities, setUniversities] = useState<University[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);

  useEffect(() => { getUniversities().then(setUniversities).catch(() => setUniversities([])); }, []);
  useEffect(() => {
    if (!universityId) { setFaculties([]); return; }
    getFaculties(universityId).then(setFaculties).catch(() => setFaculties([]));
  }, [universityId]);

  function updateParam(key: string, value: string, reset: string[] = []) {
    const p = new URLSearchParams(sp.toString());
    value ? p.set(key, value) : p.delete(key);
    reset.forEach((k) => p.delete(k));
    router.push(`/doctors?${p.toString()}`);
  }

  return (
    <div className="rounded-[24px] border border-olive/10 bg-white/80 p-5 shadow-card">
      <div className="grid gap-3 sm:grid-cols-3">
        <form
          className="sm:col-span-3"
          onSubmit={(e) => { e.preventDefault(); updateParam("q", term.trim()); }}
        >
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="ابحث باسم الدكتور..." className={input} />
        </form>
        <select className={input} value={universityId} onChange={(e) => updateParam("university", e.target.value, ["faculty"])}>
          <option value="">كل الجامعات</option>
          {universities.map((u) => <option key={u.id} value={u.id}>{u.name_ar}</option>)}
        </select>
        <select className={input} value={facultyId} disabled={!universityId} onChange={(e) => updateParam("faculty", e.target.value)}>
          <option value="">كل الكليات</option>
          {faculties.map((f) => <option key={f.id} value={f.id}>{f.name_ar}</option>)}
        </select>
        {(q || universityId || facultyId) && (
          <button type="button" onClick={() => { setTerm(""); router.push("/doctors"); }} className="rounded-2xl bg-clay/5 py-2.5 text-xs font-bold text-clay">
            إعادة ضبط الفلاتر
          </button>
        )}
      </div>
    </div>
  );
}
