import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourses, getUniversityById } from "@/lib/data";
import UniversityCourseList from "@/components/UniversityCourseList";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const university = await getUniversityById(params.id).catch(() => null);
  if (!university) return { title: "جامعة غير موجودة" };
  return {
    title: `مساقات ${university.name_ar}`,
    alternates: { canonical: `/universities/${params.id}` },
    description: `تصفح كافة المساقات والملخصات والامتحانات السابقة الخاصة بـ ${university.name_ar} على منصة PUSH.`,
    openGraph: {
      title: `مساقات ${university.name_ar} | PUSH`,
      description: `تصفح كافة المساقات والملخصات والامتحانات السابقة الخاصة بـ ${university.name_ar}.`,
    },
  };
}

export default async function UniversityCoursesPage({ params }: { params: { id: string } }) {
  const university = await getUniversityById(params.id).catch(() => null);
  if (!university) notFound();
  const courses = await getCourses(params.id).catch(() => []);

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-olive/10 bg-[#eef1e9]">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
          <Link href="/universities" className="text-sm font-bold text-olive/60 hover:text-clay">
            ← كل الجامعات
          </Link>
          <span className="mt-4 block text-xs font-bold tracking-widest text-clay">المساقات</span>
          <h1 className="mt-2 font-display text-4xl font-bold text-olive-dark sm:text-5xl">
            {university.name_ar}
          </h1>
          <p className="mt-3 text-sm leading-7 text-ink/55">
            اختر المساق لعرض كل منشوراته، أو ابحث عنه باسمه أو رقمه.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <UniversityCourseList
          universityId={university.id}
          courses={courses.map((c) => ({ id: c.id, name_ar: c.name_ar, code: c.code }))}
        />
      </div>
    </div>
  );
}
