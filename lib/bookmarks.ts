"use client";

import { useEffect, useState } from "react";
import type { Material } from "./types";

export interface BookmarkedMaterial {
  id: string;
  title_ar: string;
  course_name?: string;
  university_name?: string;
  faculty_name?: string;
  type: string;
  drive_link?: string | null;
  downloads_count?: number;
  savedAt: string;
}

export interface SemesterCourse {
  id: string;
  name_ar: string;
  code?: string | null;
  university_name?: string;
  faculty_name?: string;
  university_id?: string;
  faculty_id?: string;
  savedAt: string;
}

const MATERIALS_KEY = "push_saved_materials_v1";
const COURSES_KEY = "push_semester_courses_v1";
const EVENT_NAME = "push-bookmarks-changed";

function notifyChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export function getSavedMaterials(): BookmarkedMaterial[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MATERIALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isMaterialSaved(id: string): boolean {
  if (!id) return false;
  const list = getSavedMaterials();
  return list.some((m) => m.id === id);
}

export function toggleSaveMaterial(material: Material | BookmarkedMaterial): boolean {
  if (typeof window === "undefined" || !material?.id) return false;
  const current = getSavedMaterials();
  const exists = current.some((m) => m.id === material.id);
  let updated: BookmarkedMaterial[];

  if (exists) {
    updated = current.filter((m) => m.id !== material.id);
  } else {
    const item: BookmarkedMaterial = {
      id: material.id,
      title_ar: material.title_ar,
      course_name: material.course_name,
      university_name: material.university_name,
      faculty_name: material.faculty_name,
      type: material.type,
      drive_link: material.drive_link,
      downloads_count: material.downloads_count,
      savedAt: new Date().toISOString(),
    };
    updated = [item, ...current];
  }

  try {
    localStorage.setItem(MATERIALS_KEY, JSON.stringify(updated));
    notifyChange();
  } catch {
    // quota exceeded or private mode
  }
  return !exists;
}

export function removeSavedMaterial(id: string): void {
  if (typeof window === "undefined" || !id) return;
  const current = getSavedMaterials();
  const updated = current.filter((m) => m.id !== id);
  try {
    localStorage.setItem(MATERIALS_KEY, JSON.stringify(updated));
    notifyChange();
  } catch {}
}

export function getSemesterCourses(): SemesterCourse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COURSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isCourseInSemester(id: string): boolean {
  if (!id) return false;
  const list = getSemesterCourses();
  return list.some((c) => c.id === id);
}

export function toggleSemesterCourse(course: {
  id: string;
  name_ar: string;
  code?: string | null;
  university_name?: string;
  faculty_name?: string;
  university_id?: string;
  faculty_id?: string;
}): boolean {
  if (typeof window === "undefined" || !course?.id) return false;
  const current = getSemesterCourses();
  const exists = current.some((c) => c.id === course.id);
  let updated: SemesterCourse[];

  if (exists) {
    updated = current.filter((c) => c.id !== course.id);
  } else {
    const item: SemesterCourse = {
      id: course.id,
      name_ar: course.name_ar,
      code: course.code,
      university_name: course.university_name,
      faculty_name: course.faculty_name,
      university_id: course.university_id,
      faculty_id: course.faculty_id,
      savedAt: new Date().toISOString(),
    };
    updated = [item, ...current];
  }

  try {
    localStorage.setItem(COURSES_KEY, JSON.stringify(updated));
    notifyChange();
  } catch {}
  return !exists;
}

export function removeSemesterCourse(id: string): void {
  if (typeof window === "undefined" || !id) return;
  const current = getSemesterCourses();
  const updated = current.filter((c) => c.id !== id);
  try {
    localStorage.setItem(COURSES_KEY, JSON.stringify(updated));
    notifyChange();
  } catch {}
}

export function useBookmarks() {
  const [materials, setMaterials] = useState<BookmarkedMaterial[]>([]);
  const [courses, setCourses] = useState<SemesterCourse[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => {
      setMaterials(getSavedMaterials());
      setCourses(getSemesterCourses());
    };
    sync();

    window.addEventListener(EVENT_NAME, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT_NAME, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    mounted,
    materials,
    courses,
    totalCount: materials.length + courses.length,
    isMaterialSaved: (id: string) => (mounted ? materials.some((m) => m.id === id) : false),
    isCourseSaved: (id: string) => (mounted ? courses.some((c) => c.id === id) : false),
    toggleMaterial: (m: Material | BookmarkedMaterial) => toggleSaveMaterial(m),
    toggleCourse: (c: any) => toggleSemesterCourse(c),
    removeMaterial: (id: string) => removeSavedMaterial(id),
    removeCourse: (id: string) => removeSemesterCourse(id),
  };
}
