"use client";

import { useEffect, useState } from "react";

export interface FavoriteCourseItem {
  id: string;
  university_id: string;
  name_ar: string;
  code: string | null;
  university_name: string;
}

export const FAVORITE_COURSES_KEY = "push_favorite_courses";

export default function FavoriteCourseButton({ course }: { course: FavoriteCourseItem }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const list = JSON.parse(
        localStorage.getItem(FAVORITE_COURSES_KEY) || "[]"
      ) as FavoriteCourseItem[];
      setSaved(list.some((x) => x.id === course.id));
    } catch {
      // تجاهل
    }
  }, [course.id]);

  function toggle() {
    try {
      const list = JSON.parse(
        localStorage.getItem(FAVORITE_COURSES_KEY) || "[]"
      ) as FavoriteCourseItem[];
      const exists = list.some((x) => x.id === course.id);
      const next = exists ? list.filter((x) => x.id !== course.id) : [course, ...list];
      localStorage.setItem(FAVORITE_COURSES_KEY, JSON.stringify(next));
      setSaved(!exists);
    } catch {
      // تجاهل
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
        saved
          ? "border-gold bg-gold/15 text-olive-dark"
          : "border-olive/15 bg-white text-olive-dark hover:border-gold/40"
      }`}
    >
      <span>{saved ? "★" : "☆"}</span>
      <span>{saved ? "ضمن مساقاتي المفضلة" : "أضف إلى مساقاتي"}</span>
    </button>
  );
}
