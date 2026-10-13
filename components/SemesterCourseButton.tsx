"use client";

import { useState } from "react";
import { useBookmarks } from "@/lib/bookmarks";

interface SemesterCourseButtonProps {
  course: {
    id: string;
    name_ar: string;
    code?: string | null;
    university_name?: string;
    faculty_name?: string;
    university_id?: string;
    faculty_id?: string;
  };
  className?: string;
}

export default function SemesterCourseButton({
  course,
  className = "",
}: SemesterCourseButtonProps) {
  const { mounted, isCourseSaved, toggleCourse } = useBookmarks();
  const [animating, setAnimating] = useState(false);

  const active = mounted ? isCourseSaved(course.id) : false;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAnimating(true);
    toggleCourse(course);
    setTimeout(() => setAnimating(false), 300);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition shadow-card ${
        active
          ? "bg-olive text-parchment hover:bg-olive-dark ring-2 ring-olive/20"
          : "border border-olive/20 bg-white/90 text-olive-dark hover:border-olive hover:bg-white"
      } ${className}`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs transition-transform duration-300 ${
          active ? "bg-white/20 text-parchment" : "bg-olive/10 text-olive"
        } ${animating ? "scale-125" : ""}`}
      >
        {active ? "✓" : "📌"}
      </span>
      <span>
        {active ? "مساق فصلي (ضمن موادي)" : "أضف إلى مقرراتي هذا الفصل"}
      </span>
    </button>
  );
}
