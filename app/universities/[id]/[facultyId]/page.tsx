import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourses, getFacultyById, getUniversityById } from "@/lib/data";

export const revalidate = 60;

export default async function FacultyCoursesPage({ params }: { params: { id: string; facultyId: string } }) {
  const [university, faculty] = await Promise.all([
    getUniversityById(params.id).catch(() => null),
    getFacultyById(params.facultyId).catch(() => null),
  ]);
  if (!university || !faculty || faculty.university_id !== university.id) notFound();
  const courses = await getCourses(params.facultyId).catch(() => []);

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-olive/10 bg-[#eef1e9]">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-olive/60">
            <Link href="/universities" className="hover:text-clay">الجامعات</Link><span>/</span>
            <Link href={`/universities/${university.id}`} className="hover:text-clay">{university.name_ar}</Link>
          </div>
          <span className="mt-4 block text-xs font-bold tracking-widest text-clay">المساقات</span>
          <h1 className="mt-2 font-display text-4xl font-bold text-olive-dark sm:text-5xl">{faculty.name_ar}</h1>
          <p className="mt-3 text-sm leading-7 text-ink/55">اختر المساق لعرض كل منشوراته.</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        {courses.length === 0 && (
          <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
            <h2 className="font-display text-2xl font-bold text-olive-dark">لا توجد مساقات مضافة بعد لهذه الكلية</h2>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <Link
              key={c.id}
              href={`/universities/${university.id}/${faculty.id}/${c.id}`}
              className="group flex items-center justify-between rounded-3xl border border-olive/10 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft"
            >
              <span>
                <span className="block font-display text-lg font-bold text-olive-dark">{c.name_ar}</span>
                <span className="mt-1 block text-xs font-bold text-ink/40">{c.code || "بدون رمز"}</span>
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive/5 text-olive transition group-hover:bg-olive group-hover:text-parchment">←</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
