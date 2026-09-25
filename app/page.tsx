import Link from "next/link";
import { Suspense } from "react";
import SearchBox from "@/components/SearchBox";
import MaterialCarousel from "@/components/MaterialCarousel";
import MaterialCard from "@/components/MaterialCard";
import TypeIcon from "@/components/TypeIcon";
import { getFeaturedMaterials, getRecentMaterials, getUniversities } from "@/lib/data";
import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const [featured, recent, universities] = await Promise.all([
    safe(getFeaturedMaterials(10)),
    safe(getRecentMaterials(8)),
    safe(getUniversities()),
  ]);

  return (
    <div className="overflow-hidden">
      <section className="relative isolate border-b border-olive/10 bg-[#eef1e9]">
        <div aria-hidden className="pointer-events-none absolute -left-32 top-8 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-28 top-24 h-[28rem] w-[28rem] rounded-full bg-clay/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-clay via-gold to-olive" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-olive/10 bg-white/75 px-3.5 py-2 text-xs font-bold text-olive shadow-sm">
              <span className="h-2 w-2 rounded-full bg-gold" />
              منصة طلابية تطوعية · المعرفة للجميع
            </div>

            <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight text-olive-dark sm:text-6xl lg:text-[4.5rem]">
              كل ما تحتاجه للدراسة،
              <span className="block text-clay">في مكان واحد.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-ink/65 sm:text-lg">
              ملخصات، امتحانات سابقة، ملفات مرجعية وفيديوهات شرح — مكتبة رقمية
              مرتبة تساعدك على الوصول للمعلومة بأقل عدد من الخطوات.
            </p>

            <div className="mt-8 max-w-2xl">
              <Suspense fallback={null}>
                <SearchBox />
              </Suspense>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(Object.keys(MATERIAL_TYPE_LABELS) as MaterialType[]).map((t) => (
                <Link
                  key={t}
                  href={`/browse?type=${t}`}
                  className="group flex items-center gap-2 rounded-full border border-olive/10 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink/65 shadow-sm transition hover:-translate-y-0.5 hover:border-gold/40 hover:bg-white hover:text-olive-dark"
                >
                  <TypeIcon type={t} className="h-4 w-4 text-olive/70" />
                  {MATERIAL_TYPE_LABELS[t]}
                  <span className="opacity-30 transition group-hover:-translate-x-0.5">←</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-lg lg:block">
            <div className="animate-float-soft relative rounded-[36px] border border-white/80 bg-white/60 p-3 shadow-soft backdrop-blur">
              <div className="overflow-hidden rounded-[29px] bg-olive p-7 text-parchment sm:p-9">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tracking-widest">PUSH</span>
                  <span className="text-xs text-parchment/60">مكتبة اليوم</span>
                </div>

                <div className="mt-16 font-display text-4xl leading-tight sm:text-5xl">
                  مادة واحدة قد
                  <br />
                  <span className="text-gold-light">تختصر عليك ساعات.</span>
                </div>

                <div className="mt-12 grid grid-cols-3 gap-2">
                  {[
                    ["ملخصات", "01"],
                    ["امتحانات", "02"],
                    ["فيديوهات", "03"],
                  ].map(([label, number]) => (
                    <div key={number} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                      <div className="text-[10px] text-parchment/45">{number}</div>
                      <div className="mt-5 text-xs font-bold">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-6 rounded-2xl border border-white bg-white px-4 py-3 shadow-card">
              <p className="text-[10px] text-ink/45">مصمم للطلاب</p>
              <p className="mt-1 font-bold text-olive-dark">بسيط · سريع · مجاني</p>
            </div>
          </div>
        </div>
      </section>

      {(featured.length > 0 || recent.length > 0 || universities.length > 0) && (
        <section className="border-b border-olive/10 bg-white/60">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden px-5 py-4 sm:grid-cols-4 sm:px-8">
            <Stat value={String(featured.length + recent.length)} label="مواد ظاهرة الآن" />
            <Stat value={String(universities.length)} label="جامعات" />
            <Stat value="4" label="أنواع للمحتوى" />
            <Stat value="24/7" label="وصول للمكتبة" />
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="مختارات" title="ابدأ من المواد المميزة">
            <Link href="/browse" className="rounded-full border border-olive/10 bg-white px-4 py-2 text-sm font-bold text-olive/70 shadow-sm transition hover:border-gold/40 hover:text-clay">
              عرض المكتبة ←
            </Link>
          </SectionHeading>
          <MaterialCarousel items={featured} />
        </section>
      )}

      {universities.length > 0 && (
        <section className="border-y border-olive/10 bg-[#eef1e9]/70">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <SectionHeading eyebrow="تصفّح حسب" title="اختر جامعتك">
              <Link href="/browse" className="text-sm font-bold text-olive/60 hover:text-clay">كل المواد ←</Link>
            </SectionHeading>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {universities.map((u, index) => (
                <Link
                  key={u.id}
                  href={`/browse?university=${u.id}`}
                  className="group relative flex min-h-[92px] items-center justify-between overflow-hidden rounded-3xl border border-olive/10 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft"
                >
                  <span className="absolute -left-5 -top-8 h-24 w-24 rounded-full bg-gold/10" />
                  <span className="relative flex items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-olive/5 text-sm font-black text-olive">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-bold text-ink/80">{u.name_ar}</span>
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive/5 text-olive transition group-hover:bg-olive group-hover:text-parchment">←</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <SectionHeading eyebrow="وصل حديثًا" title="أحدث ما أُضيف">
            <Link href="/browse" className="rounded-full bg-olive px-4 py-2 text-sm font-bold text-parchment shadow-card transition hover:bg-olive-dark">كل المواد ←</Link>
          </SectionHeading>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((m) => <MaterialCard key={m.id} material={m} />)}
          </div>
        </section>
      )}

      {featured.length === 0 && recent.length === 0 && (
        <section className="mx-auto max-w-2xl px-5 py-28 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-olive/8 text-olive-dark">
            <TypeIcon type="file" className="h-8 w-8" />
          </div>
          <h2 className="font-display text-3xl font-bold text-olive-dark">المكتبة قيد التجهيز</h2>
          <p className="mt-3 leading-7 text-ink/55">لم تتم إضافة أي مواد بعد. تابعونا قريبًا مع أول دفعة من المحتوى الدراسي.</p>
          <Link href="/browse" className="mt-7 inline-flex rounded-full bg-olive px-6 py-3 text-sm font-bold text-parchment">استكشاف المكتبة</Link>
        </section>
      )}
    </div>
  );
}

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4">
      <div>
        <span className="text-xs font-black uppercase tracking-[0.2em] text-clay">{eyebrow}</span>
        <h2 className="mt-1 font-display text-3xl font-bold text-olive-dark sm:text-4xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 py-3 text-center sm:border-l sm:border-olive/10 last:sm:border-l-0">
      <div className="font-display text-2xl font-bold text-olive-dark">{value}</div>
      <div className="mt-0.5 text-[11px] font-bold text-ink/45">{label}</div>
    </div>
  );
}

async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try { return await p; } catch { return []; }
}
