"use client";

import { useState } from "react";
import Link from "next/link";
import { useBookmarks } from "@/lib/bookmarks";
import TypeBadge from "@/components/TypeBadge";

export default function BookmarksPage() {
  const {
    mounted,
    materials,
    courses,
    removeMaterial,
    removeCourse,
    totalCount,
  } = useBookmarks();

  const [activeTab, setActiveTab] = useState<"courses" | "materials">("courses");

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      {/* Page Header */}
      <section className="relative overflow-hidden border-b border-olive/10 bg-[#eef1e9] py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-olive/15 bg-white/75 px-3.5 py-1.5 text-xs font-bold text-olive shadow-sm">
            <span>📌</span> لوحة الطالب الشخصية
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold text-olive-dark sm:text-5xl">
            مقرراتي ومحفوظاتي الدراسية
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink/65">
            مكانك المخصص لتنظيم مساقات الفصل الحالي والوصول السريع للملخصات والامتحانات المحفوظة في أي وقت.
          </p>

          {/* Quick Stats */}
          <div className="mt-8 flex flex-wrap gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-olive/10 bg-white/80 px-5 py-3 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-olive/10 text-lg">📚</span>
              <div>
                <div className="font-display text-xl font-bold text-olive-dark">
                  {mounted ? courses.length : 0}
                </div>
                <div className="text-[11px] font-bold text-ink/50">مقررات هذا الفصل</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-olive/10 bg-white/80 px-5 py-3 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-lg">⭐</span>
              <div>
                <div className="font-display text-xl font-bold text-olive-dark">
                  {mounted ? materials.length : 0}
                </div>
                <div className="text-[11px] font-bold text-ink/50">مواد وملخصات محفوظة</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs and Content Section */}
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {/* Tab Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-olive/15 pb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("courses")}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition ${
                activeTab === "courses"
                  ? "bg-olive text-parchment shadow-card"
                  : "bg-white/70 text-ink/60 hover:bg-white hover:text-olive-dark"
              }`}
            >
              <span>مقررات الفصل الحالي</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === "courses" ? "bg-white/20 text-parchment" : "bg-olive/10 text-olive"
                }`}
              >
                {mounted ? courses.length : 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("materials")}
              className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold transition ${
                activeTab === "materials"
                  ? "bg-olive text-parchment shadow-card"
                  : "bg-white/70 text-ink/60 hover:bg-white hover:text-olive-dark"
              }`}
            >
              <span>المواد والملخصات المفضلة</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === "materials" ? "bg-white/20 text-parchment" : "bg-olive/10 text-olive"
                }`}
              >
                {mounted ? materials.length : 0}
              </span>
            </button>
          </div>

          <Link
            href="/universities"
            className="rounded-full border border-olive/15 bg-white px-4 py-2 text-xs font-bold text-olive-dark shadow-sm hover:border-gold hover:text-clay"
          >
            + استكشاف وإضافة مساقات أخرى
          </Link>
        </div>

        {/* Tab 1: Semester Courses */}
        {activeTab === "courses" && (
          <div className="mt-8">
            {!mounted || courses.length === 0 ? (
              <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
                <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-olive/10 text-3xl">
                  📚
                </span>
                <h3 className="mt-4 font-display text-2xl font-bold text-olive-dark">
                  لم تقم بإضافة مقررات لهذا الفصل بعد
                </h3>
                <p className="mt-2 max-w-md mx-auto text-sm text-ink/55">
                  عند تصفح أي مساق، اضغط على زر «📌 أضف إلى مقرراتي هذا الفصل» لتثبيته هنا والوصول لجميع مواده بسرعة طوال الفصل.
                </p>
                <Link
                  href="/universities"
                  className="mt-6 inline-flex rounded-2xl bg-olive px-6 py-3 text-sm font-bold text-parchment shadow-card hover:bg-olive-dark"
                >
                  استعراض المساقات والجامعات ←
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-olive/10 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-lg bg-olive/10 px-2.5 py-1 text-xs font-bold text-olive">
                          {course.code || "مساق فصلي"}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCourse(course.id)}
                          title="إزالة من مقررات الفصل"
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 transition hover:bg-red-50 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>

                      <h3 className="mt-4 font-display text-xl font-bold text-olive-dark">
                        {course.name_ar}
                      </h3>

                      <p className="mt-1 text-xs text-ink/55">
                        {course.faculty_name}
                        {course.university_name ? ` · ${course.university_name}` : ""}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-olive/5 flex items-center justify-between">
                      <Link
                        href={
                          course.university_id && course.faculty_id
                            ? `/universities/${course.university_id}/${course.faculty_id}/${course.id}`
                            : `/browse?q=${encodeURIComponent(course.name_ar)}`
                        }
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-clay hover:underline"
                      >
                        عرض مواد هذا المساق ←
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Bookmarked Materials */}
        {activeTab === "materials" && (
          <div className="mt-8">
            {!mounted || materials.length === 0 ? (
              <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
                <span className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-gold/20 text-3xl">
                  ⭐
                </span>
                <h3 className="mt-4 font-display text-2xl font-bold text-olive-dark">
                  قائمة المواد المفضلة فارغة حالياً
                </h3>
                <p className="mt-2 max-w-md mx-auto text-sm text-ink/55">
                  أثناء تصفح المكتبة والامتحانات، اضغط على أيقونة الإشارة المرجعية لحفظ التلخيص والرجوع إليه قبل الاختبار.
                </p>
                <Link
                  href="/browse"
                  className="mt-6 inline-flex rounded-2xl bg-clay px-6 py-3 text-sm font-bold text-parchment shadow-card hover:bg-clay-dark"
                >
                  تصفح المكتبة الشاملة ←
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    className="group relative flex flex-col justify-between rounded-3xl border border-olive/10 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-gold/40"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <TypeBadge type={m.type as any} />
                        <button
                          type="button"
                          onClick={() => removeMaterial(m.id)}
                          title="إزالة من المفضلة"
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-ink/40 transition hover:bg-red-50 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>

                      <h3 className="mt-3 font-display text-lg font-bold leading-snug text-ink">
                        {m.title_ar}
                      </h3>

                      <p className="mt-1 text-xs text-ink/55">
                        {m.course_name}
                        {m.university_name ? ` · ${m.university_name}` : ""}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-ink/5 pt-4">
                      <Link
                        href={`/material/${m.id}`}
                        className="rounded-xl bg-olive/10 px-4 py-2 text-xs font-bold text-olive hover:bg-olive hover:text-parchment transition"
                      >
                        عرض وقراءة الملف 📖
                      </Link>
                      {m.downloads_count !== undefined && (
                        <span className="text-[11px] text-ink/40">
                          {m.downloads_count} مشاهدة
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
