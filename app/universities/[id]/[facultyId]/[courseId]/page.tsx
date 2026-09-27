import Link from "next/link";
import { notFound } from "next/navigation";
import MaterialCard from "@/components/MaterialCard";
import { getCourseById, getFacultyById, getUniversityById, searchMaterials } from "@/lib/data";

export const revalidate = 30;

export default async function CourseMaterialsPage({ params }: { params: { id: string; facultyId: string; courseId: string } }) {
  const [university, faculty, course] = await Promise.all([
    getUniversityById(params.id).catch(() => null),
    getFacultyById(params.facultyId).catch(() => null),
    getCourseById(params.courseId).catch(() => null),
  ]);
  if (!university || !faculty || !course || faculty.university_id !== university.id || course.faculty_id !== faculty.id) notFound();

  const { items } = await searchMaterials({ courseId: course.id, pageSize: 50 }).catch(() => ({ items: [], count: 0 }));

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-olive/10 bg-[#eef1e9]">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-olive/60">
            <Link href="/universities" className="hover:text-clay">الجامعات</Link><span>/</span>
            <Link href={`/universities/${university.id}`} className="hover:text-clay">{university.name_ar}</Link><span>/</span>
            <Link href={`/universities/${university.id}/${faculty.id}`} className="hover:text-clay">{faculty.name_ar}</Link>
          </div>
          <span className="mt-4 block text-xs font-bold tracking-widest text-clay">منشورات المساق</span>
          <h1 className="mt-2 font-display text-4xl font-bold text-olive-dark sm:text-5xl">{course.name_ar}</h1>
          <p className="mt-3 text-sm leading-7 text-ink/55">{course.code ? `رمز المساق: ${course.code}` : "بدون رمز"} · {items.length} منشور</p>
          <Link href={`/submit?course=${course.id}`} className="mt-5 inline-flex rounded-2xl bg-clay px-5 py-3 text-sm font-black text-parchment hover:bg-clay-dark">+ أضف مادة لهذا المساق</Link>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {items.length === 0 && (
          <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
            <h2 className="font-display text-2xl font-bold text-olive-dark">لا توجد منشورات في هذا المساق بعد</h2>
            <p className="mt-2 text-sm text-ink/50">كن أول من يضيف ملخصًا أو امتحانًا أو فيديو شرح لهذا المساق.</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((m) => <MaterialCard key={m.id} material={m} />)}
        </div>
      </div>
    </div>
  );
}
