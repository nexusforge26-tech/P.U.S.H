import Link from "next/link";
import { getUniversities } from "@/lib/data";
import CourseSearch from "@/components/CourseSearch";

export const revalidate = 60;

export default async function UniversitiesPage() {
  let universities: Awaited<ReturnType<typeof getUniversities>> = [];
  let errored = false;
  try { universities = await getUniversities(); } catch { errored = true; }

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-olive/10 bg-[#eef1e9]">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
          <span className="text-xs font-bold tracking-widest text-clay">تصفح متسلسل</span>
          <h1 className="mt-2 font-display text-4xl font-bold text-olive-dark sm:text-5xl">جامعة ← كلية ← مساق ← منشورات</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/55 sm:text-base">
            اختر جامعتك ثم كليتك ثم مساقك لترى كل ما نُشر فيه، أو ابحث عن المساق مباشرةً باسمه أو رقمه.
          </p>
          <div className="mt-7 max-w-xl">
            <CourseSearch />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        {errored && (
          <div className="rounded-2xl border border-clay/20 bg-clay/5 p-5 text-sm leading-7 text-clay-dark">
            تعذّر الاتصال بقاعدة البيانات. تحقق من متغيرات Supabase.
          </div>
        )}
        {!errored && universities.length === 0 && (
          <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
            <h2 className="font-display text-2xl font-bold text-olive-dark">لا توجد جامعات بعد</h2>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {universities.map((u, i) => (
            <Link
              key={u.id}
              href={`/universities/${u.id}`}
              className="group flex items-center justify-between rounded-3xl border border-olive/10 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft"
            >
              <span className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-olive/7 text-sm font-black text-olive-dark">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display text-xl font-bold text-olive-dark">{u.name_ar}</span>
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive/5 text-olive transition group-hover:bg-olive group-hover:text-parchment">←</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
