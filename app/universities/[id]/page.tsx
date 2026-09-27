import Link from "next/link";
import { notFound } from "next/navigation";
import { getFaculties, getUniversityById } from "@/lib/data";

export const revalidate = 60;

export default async function UniversityFacultiesPage({ params }: { params: { id: string } }) {
  const university = await getUniversityById(params.id).catch(() => null);
  if (!university) notFound();
  const faculties = await getFaculties(params.id).catch(() => []);

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-olive/10 bg-[#eef1e9]">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
          <Link href="/universities" className="text-sm font-bold text-olive/60 hover:text-clay">← كل الجامعات</Link>
          <span className="mt-4 block text-xs font-bold tracking-widest text-clay">الكليات</span>
          <h1 className="mt-2 font-display text-4xl font-bold text-olive-dark sm:text-5xl">{university.name_ar}</h1>
          <p className="mt-3 text-sm leading-7 text-ink/55">اختر الكلية للوصول إلى مساقاتها.</p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        {faculties.length === 0 && (
          <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
            <h2 className="font-display text-2xl font-bold text-olive-dark">لا توجد كليات مضافة بعد لهذه الجامعة</h2>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {faculties.map((f) => (
            <Link
              key={f.id}
              href={`/universities/${university.id}/${f.id}`}
              className="group flex items-center justify-between rounded-3xl border border-olive/10 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft"
            >
              <span className="font-display text-lg font-bold text-olive-dark">{f.name_ar}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive/5 text-olive transition group-hover:bg-olive group-hover:text-parchment">←</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
