import Link from "next/link";
import { Suspense } from "react";
import SearchBox from "@/components/SearchBox";
import FilterBar from "@/components/FilterBar";
import MaterialCard from "@/components/MaterialCard";
import { searchMaterials } from "@/lib/data";
import type { MaterialSort, MaterialType } from "@/lib/types";

export const revalidate = 30;

interface Props {
  searchParams: {
    q?: string;
    university?: string;
    course?: string;
    type?: string;
    semester?: string;
    year?: string;
    sort?: string;
    page?: string;
  };
}

const PAGE_SIZE = 12;

/**
 * ينشئ أرقام الصفحات مع اختصار (…) عندما يكون عدد الصفحات كبيرًا.
 */
function getPaginationRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);

  if (left > 2) pages.push("ellipsis");
  for (let p = left; p <= right; p++) {
    pages.push(p);
  }
  if (right < total - 1) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default async function BrowsePage({ searchParams }: Props) {
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const sort: MaterialSort =
    searchParams.sort === "downloads" || searchParams.sort === "helpful"
      ? searchParams.sort
      : "newest";

  let items: Awaited<ReturnType<typeof searchMaterials>>["items"] = [];
  let count = 0;
  let errored = false;

  try {
    const r = await searchMaterials({
      q: searchParams.q,
      universityId: searchParams.university,
      courseId: searchParams.course,
      type: searchParams.type as MaterialType | undefined,
      semester: searchParams.semester,
      academicYear: searchParams.year,
      sort,
      page,
      pageSize: PAGE_SIZE,
    });
    items = r.items;
    count = r.count;
  } catch {
    errored = true;
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const paginationItems = getPaginationRange(page, totalPages);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    params.set("page", String(p));
    return `/browse?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-[#f7f5ef]">
      <section className="border-b border-olive/10 bg-[#eef1e9]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="max-w-3xl">
            <span className="text-xs font-bold tracking-widest text-clay">المكتبة</span>
            <h1 className="mt-2 font-display text-4xl font-bold text-olive-dark sm:text-5xl">
              ابحث. صفِّ النتائج. ابدأ الدراسة.
            </h1>
            <p className="mt-3 text-sm leading-7 text-ink/55 sm:text-base">
              ابحث بعنوان المادة أو وصفها أو اسم المساق أو رمزه، واستخدم الفلاتر للوصول إلى ما
              تحتاجه بأقل عدد من الخطوات.
            </p>
          </div>
          <div className="mt-7 max-w-3xl">
            <Suspense fallback={null}>
              <SearchBox />
            </Suspense>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[260px_1fr]">
          <Suspense fallback={<div className="h-64 rounded-3xl bg-white/50" />}>
            <FilterBar />
          </Suspense>

          <div>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-bold text-ink/55">
                {errored ? "تعذّر تحميل المواد حاليًا" : `${count.toLocaleString("ar")} نتيجة`}
              </p>
            </div>

            {errored && (
              <div className="mb-5 rounded-2xl border border-clay/20 bg-clay/5 p-6 text-sm leading-7 text-clay-dark">
                <p className="font-bold">تعذّر الاتصال بخادم المكتبة في الوقت الحالي.</p>
                <p className="mt-1 text-xs text-ink/60">
                  يرجى التحقق من اتصالك بالإنترنت وتحديث الصفحة بعد قليل.
                </p>
              </div>
            )}

            {!errored && items.length === 0 && (
              <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
                <div className="mx-auto h-10 w-10 rounded-2xl bg-olive/8" />
                <h2 className="mt-4 font-display text-2xl font-bold text-olive-dark">
                  لا توجد نتائج مطابقة
                </h2>
                <p className="mt-2 text-sm text-ink/50">
                  جرّب تعديل كلمات البحث أو إزالة بعض الفلاتر.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((m) => (
                <MaterialCard key={m.id} material={m} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                aria-label="ترقيم الصفحات"
                className="mt-10 flex flex-wrap items-center justify-center gap-2"
              >
                {page > 1 && (
                  <Link
                    href={pageHref(page - 1)}
                    className="flex h-10 items-center justify-center rounded-xl border border-olive/10 bg-white px-3 text-xs font-bold text-ink/65 transition hover:border-gold/40"
                  >
                    السابق
                  </Link>
                )}

                {paginationItems.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="flex h-10 w-8 items-center justify-center text-sm font-bold text-ink/40"
                    >
                      …
                    </span>
                  ) : (
                    <Link
                      key={item}
                      href={pageHref(item)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition ${
                        item === page
                          ? "bg-olive text-parchment"
                          : "border border-olive/10 bg-white text-ink/55 hover:border-gold/40"
                      }`}
                    >
                      {item}
                    </Link>
                  )
                )}

                {page < totalPages && (
                  <Link
                    href={pageHref(page + 1)}
                    className="flex h-10 items-center justify-center rounded-xl border border-olive/10 bg-white px-3 text-xs font-bold text-ink/65 transition hover:border-gold/40"
                  >
                    التالي
                  </Link>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
