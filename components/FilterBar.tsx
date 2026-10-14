"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCourses, getUniversities } from "@/lib/data";
import type { Course, University } from "@/lib/types";
import { MATERIAL_TYPE_LABELS, SEMESTER_LABELS, type MaterialType } from "@/lib/types";

const select = "w-full rounded-2xl border border-olive/10 bg-white px-3.5 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-gold disabled:cursor-not-allowed disabled:bg-ink/3";

export default function FilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const universityId = sp.get("university") ?? "";
  const courseId = sp.get("course") ?? "";
  const type = sp.get("type") ?? "";
  const semester = sp.get("semester") ?? "";
  const [u, setU] = useState<University[]>([]);
  const [c, setC] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);
  const active = [universityId, courseId, type, semester].filter(Boolean).length;

  useEffect(() => { getUniversities().then(setU).catch(() => setU([])); }, []);
  useEffect(() => {
    if (!universityId) { setC([]); return; }
    getCourses(universityId).then(setC).catch(() => setC([]));
  }, [universityId]);

  function updateParam(key: string, value: string, reset: string[] = []) {
    const p = new URLSearchParams(sp.toString());
    value ? p.set(key, value) : p.delete(key);
    reset.forEach((k) => p.delete(k));
    p.delete("page");
    router.push(`/browse?${p.toString()}`);
  }

  return (
    <aside className="rounded-[24px] border border-olive/10 bg-white/80 p-5 shadow-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-sm font-bold lg:hidden">
        <span className="flex items-center gap-2">الفلاتر {active > 0 && <span className="rounded-full bg-clay px-2 py-0.5 text-xs text-parchment">{active}</span>}</span>
        <span>⌄</span>
      </button>
      <div className={`${open ? "mt-5 flex" : "hidden"} flex-col gap-5 lg:mt-0 lg:flex`}>
        <div>
          <p className="mb-3 text-xs font-bold text-ink/50">نوع المادة</p>
          <div className="grid grid-cols-2 gap-2">
            {(["exam", "summary", "file", "video"] as MaterialType[]).map((t) => (
              <button key={t} type="button" onClick={() => updateParam("type", type === t ? "" : t)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${type === t ? "border-clay bg-clay text-parchment" : "border-olive/10 bg-white text-ink/60 hover:border-gold/40"}`}>
                {MATERIAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-2 text-xs font-bold text-ink/55"><span>الجامعة</span>
          <select className={select} value={universityId} onChange={(e) => updateParam("university", e.target.value, ["course"])}>
            <option value="">كل الجامعات</option>
            {u.map((x) => <option key={x.id} value={x.id}>{x.name_ar}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-bold text-ink/55"><span>المساق</span>
          <select className={select} value={courseId} disabled={!universityId} onChange={(e) => updateParam("course", e.target.value)}>
            <option value="">{universityId ? "كل المساقات" : "اختر الجامعة أولًا"}</option>
            {c.map((x) => <option key={x.id} value={x.id}>{x.name_ar}{x.code ? ` · ${x.code}` : ""}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-xs font-bold text-ink/55"><span>الفصل الدراسي</span>
          <select className={select} value={semester} onChange={(e) => updateParam("semester", e.target.value)}>
            <option value="">الكل</option>
            {Object.entries(SEMESTER_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {active > 0 && <button type="button" onClick={() => router.push("/browse")} className="rounded-xl bg-clay/5 py-2.5 text-xs font-bold text-clay">إعادة ضبط الفلاتر</button>}
      </div>
    </aside>
  );
}
