import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MaterialCard from "@/components/MaterialCard";
import FavoriteCourseButton from "@/components/FavoriteCourseButton";
import {
  getCourseById,
  getDoctorsByCourse,
  getUniversityById,
  searchMaterials,
} from "@/lib/data";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: { id: string; courseId: string };
}): Promise<Metadata> {
  const [university, course] = await Promise.all([
    getUniversityById(params.id).catch(() => null),
    getCourseById(params.courseId).catch(() => null),
  ]);
  if (!university || !course) return { title: "مساق غير موجود" };

  const title = `${course.name_ar}${course.code ? ` (${course.code})` : ""} — ${university.name_ar}`;
  const description = `ملخصات، امتحانات سابقة، وفيديوهات شرح مساق ${course.name_ar} في ${university.name_ar} على منصة PUSH.`;

  return {
    title,
    description,
    alternates: { canonical: `/universities/${params.id}/${params.courseId}` },
    openGraph: {
      title: `${title} | PUSH`,
      description,
    },
  };
}

export default async function CourseMaterialsPage({
  params,
}: {
  params: { id: string; courseId: string };
}) {
  const [university, course] = await Promise.all([
    getUniversityById(params.id).catch(() => null),
    getCourseById(params.courseId).catch(() => null),
  ]);
  if (!university || !course || course.university_id !== university.id) notFound();

  const [{ items }, courseDoctors] = await Promise.all([
    searchMaterials({ courseId: course.id, pageSize: 50 }).catch(() => ({ items: [], count: 0 })),
    getDoctorsByCourse(university.id, course.name_ar).catch(() => []),
  ]);

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-olive/10 bg-[#eef1e9]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-olive/60">
            <Link href="/universities" className="hover:text-clay">
              الجامعات
            </Link>
            <span>/</span>
            <Link href={`/universities/${university.id}`} className="hover:text-clay">
              {university.name_ar}
            </Link>
          </div>
          <span className="mt-4 block text-xs font-bold tracking-widest text-clay">
            منشورات المساق
          </span>
          <h1 className="mt-2 font-display text-4xl font-bold text-olive-dark sm:text-5xl">
            {course.name_ar}
          </h1>
          <p className="mt-3 text-sm leading-7 text-ink/55">
            {course.code ? `رمز المساق: ${course.code}` : "بدون رمز"} · {items.length} منشور
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/submit?course=${course.id}`}
              className="inline-flex rounded-2xl bg-clay px-5 py-3 text-sm font-black text-parchment shadow-card hover:bg-clay-dark"
            >
              + أضف مادة لهذا المساق
            </Link>
            <FavoriteCourseButton
              course={{
                id: course.id,
                university_id: university.id,
                name_ar: course.name_ar,
                code: course.code,
                university_name: university.name_ar,
              }}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {courseDoctors.length > 0 && (
          <div className="mb-8 rounded-3xl border border-olive/10 bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-olive-dark">
                مدرّسو هذا المساق في {university.name_ar}
              </h2>
              <Link
                href={`/doctors?university=${university.id}&q=${encodeURIComponent(course.name_ar)}`}
                className="text-xs font-bold text-clay hover:underline"
              >
                عرض في دليل الدكاترة ←
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courseDoctors.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl border border-olive/10 bg-[#fbfaf7] p-4 text-xs"
                >
                  <p className="text-sm font-bold text-olive-dark">{d.full_name}</p>
                  <p className="mt-1 text-ink/60">{d.email}</p>
                  {d.office_location && (
                    <p className="mt-1 text-ink/50">المكتب: {d.office_location}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
            <h2 className="font-display text-2xl font-bold text-olive-dark">
              لا توجد منشورات في هذا المساق بعد
            </h2>
            <p className="mt-2 text-sm text-ink/50">
              كن أول من يضيف ملخصًا أو امتحانًا أو فيديو شرح لهذا المساق.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((m) => (
            <MaterialCard key={m.id} material={m} />
          ))}
        </div>
      </div>
    </div>
  );
}
