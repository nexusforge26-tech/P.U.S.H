import Link from "next/link";
import { Suspense } from "react";
import { searchDoctors } from "@/lib/data";
import DoctorFilters from "@/components/DoctorFilters";

export const revalidate = 30;

interface Props {
  searchParams: { q?: string; university?: string; faculty?: string };
}

export default async function DoctorsPage({ searchParams }: Props) {
  let doctors: Awaited<ReturnType<typeof searchDoctors>> = [];
  let errored = false;
  try {
    doctors = await searchDoctors({ q: searchParams.q, universityId: searchParams.university, facultyId: searchParams.faculty });
  } catch {
    errored = true;
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-olive/10 bg-[#eef1e9]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <span className="text-xs font-bold tracking-widest text-clay">الدكاترة</span>
              <h1 className="mt-2 font-display text-4xl font-bold text-olive-dark sm:text-5xl">معلومات الدكاترة</h1>
              <p className="mt-3 text-sm leading-7 text-ink/55 sm:text-base">
                البريد الإلكتروني، المساقات، وموقع المكتب لكل دكتور — بمساهمة الطلبة وبعد موافقة المسؤول.
              </p>
            </div>
            <Link href="/doctors/submit" className="inline-flex shrink-0 rounded-full bg-clay px-5 py-3 text-sm font-black text-parchment shadow-card transition hover:-translate-y-0.5">
              + إضافة معلومات دكتور
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <Suspense fallback={null}>
          <DoctorFilters />
        </Suspense>

        {errored && (
          <div className="mt-5 rounded-2xl border border-clay/20 bg-clay/5 p-5 text-sm leading-7 text-clay-dark">
            تعذّر الاتصال بقاعدة البيانات. تحقق من ضبط متغيرات Supabase في ملف <code>.env.local</code>.
          </div>
        )}

        {!errored && doctors.length === 0 && (
          <div className="mt-5 rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
            <div className="mx-auto h-10 w-10 rounded-2xl bg-olive/8" />
            <h2 className="mt-4 font-display text-2xl font-bold text-olive-dark">لا توجد نتائج مطابقة</h2>
            <p className="mt-2 text-sm text-ink/50">جرّب تعديل البحث أو إزالة الفلاتر، أو كن أول من يضيف هذا الدكتور.</p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <article key={d.id} className="rounded-[26px] border border-olive/10 bg-white p-6 shadow-card">
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-olive/7 text-xl text-olive-dark">👤</span>
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-olive-dark">{d.full_name}</h2>
              <p className="mt-1 text-xs font-bold text-ink/45">{d.university_name} · {d.faculty_name}</p>
              <div className="mt-4 space-y-2 text-sm text-ink/65">
                <p className="flex items-center gap-2"><span className="text-ink/35">✉</span> <span className="break-all">{d.email}</span></p>
                {d.phone && <p className="flex items-center gap-2"><span className="text-ink/35">☎</span> {d.phone}</p>}
                {d.office_location && <p className="flex items-center gap-2"><span className="text-ink/35">⌂</span> {d.office_location}</p>}
              </div>
              {d.courses.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {d.courses.map((c, i) => (
                    <span key={i} className="rounded-full bg-olive/6 px-3 py-1 text-xs font-bold text-olive-dark">{c}</span>
                  ))}
                </div>
              )}
              <Link href={`/doctors/submit?edit=${d.id}`} className="mt-5 inline-block text-xs font-bold text-clay hover:underline">
                تعديل هذه المعلومات ←
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
