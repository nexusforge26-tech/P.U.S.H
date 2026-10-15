"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getCourses, getUniversities } from "@/lib/data";
import type { Course, MaterialSort, MaterialType, University } from "@/lib/types";
import { ACADEMIC_YEAR_OPTIONS, MATERIAL_TYPE_LABELS, SEMESTER_LABELS } from "@/lib/types";
import { SELECT_CLASS } from "@/lib/styles";

const SORT_LABELS: Record<MaterialSort, string> = {
  newest: "الأحدث إضافة",
  downloads: "الأكثر تحميلاً ومشاهدة",
  helpful: "الأعلى تقييمًا (مفيد)",
};

export default function FilterBar() {
  const router = useRouter();
  const sp = useSearchParams();
  const universityId = sp.get("university") ?? "";
  const courseId = sp.get("course") ?? "";
  const type = sp.get("type") ?? "";
  const semester = sp.get("semester") ?? "";
  const academicYear = sp.get("year") ?? "";
  const sort = (sp.get("sort") as MaterialSort) || "newest";

  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState(false);

  const active = [
    universityId,
    courseId,
    type,
    semester,
    academicYear,
    sort !== "newest" ? sort : "",
  ].filter(Boolean).length;

  useEffect(() => {
    getUniversities()
      .then(setUniversities)
      .catch(() => setUniversities([]));
  }, []);

  useEffect(() => {
    if (!universityId) {
      setCourses([]);
      return;
    }
    getCourses(universityId)
      .then(setCourses)
      .catch(() => setCourses([]));
  }, [universityId]);

  function updateParam(key: string, value: string, reset: string[] = []) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    reset.forEach((k) => p.delete(k));
    p.delete("page");
    router.push(`/browse?${p.toString()}`);
  }

  return (
    <aside className="rounded-[24px] border border-olive/10 bg-white/80 p-5 shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-bold lg:hidden"
      >
        <span className="flex items-center gap-2">
          الفلاتر والترتيب{" "}
          {active > 0 && (
            <span className="rounded-full bg-clay px-2 py-0.5 text-xs text-parchment">{active}</span>
          )}
        </span>
        <span>⌄</span>
      </button>

      <div className={`${open ? "mt-5 flex" : "hidden"} flex-col gap-5 lg:mt-0 lg:flex`}>
        <label className="flex flex-col gap-2 text-xs font-bold text-ink/55">
          <span>ترتيب النتائج</span>
          <select
            className={SELECT_CLASS}
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value === "newest" ? "" : e.target.value)}
          >
            {Object.entries(SORT_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-3 text-xs font-bold text-ink/50">نوع المادة</p>
          <div className="grid grid-cols-2 gap-2">
            {(["exam", "summary", "file", "video"] as MaterialType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => updateParam("type", type === t ? "" : t)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  type === t
                    ? "border-clay bg-clay text-parchment"
                    : "border-olive/10 bg-white text-ink/60 hover:border-gold/40"
                }`}
              >
                {MATERIAL_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-2 text-xs font-bold text-ink/55">
          <span>الجامعة</span>
          <select
            className={SELECT_CLASS}
            value={universityId}
            onChange={(e) => updateParam("university", e.target.value, ["course"])}
          >
            <option value="">كل الجامعات</option>
            {universities.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name_ar}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs font-bold text-ink/55">
          <span>المساق</span>
          <select
            className={SELECT_CLASS}
            value={courseId}
            disabled={!universityId}
            onChange={(e) => updateParam("course", e.target.value)}
          >
            <option value="">{universityId ? "كل المساقات" : "اختر الجامعة أولًا"}</option>
            {courses.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name_ar}
                {x.code ? ` · ${x.code}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs font-bold text-ink/55">
          <span>الفصل الدراسي</span>
          <select
            className={SELECT_CLASS}
            value={semester}
            onChange={(e) => updateParam("semester", e.target.value)}
          >
            <option value="">الكل</option>
            {Object.entries(SEMESTER_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-xs font-bold text-ink/55">
          <span>العام الدراسي</span>
          <select
            className={SELECT_CLASS}
            value={academicYear}
            onChange={(e) => updateParam("year", e.target.value)}
          >
            <option value="">كل الأعوام</option>
            {ACADEMIC_YEAR_OPTIONS.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </label>

        {active > 0 && (
          <button
            type="button"
            onClick={() => router.push("/browse")}
            className="rounded-xl bg-clay/5 py-2.5 text-xs font-bold text-clay hover:bg-clay/10"
          >
            إعادة ضبط الفلاتر
          </button>
        )}
      </div>
    </aside>
  );
}
