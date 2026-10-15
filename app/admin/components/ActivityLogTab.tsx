"use client";

import { useCallback, useEffect, useState } from "react";
import { ACTIVITY_ACTION_LABELS, type ActivityLogEntry } from "@/lib/types";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS, SELECT_CLASS } from "@/lib/styles";

const PAGE_SIZE = 30;

export default function ActivityLogTab() {
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (actionFilter) params.set("action", actionFilter);
    if (q.trim()) params.set("q", q.trim());

    const r = await authFetch(`/api/admin/activity-log?${params.toString()}`);
    if (r.ok) {
      const d = await r.json();
      setItems(d.items || []);
      setCount(d.count ?? (d.items || []).length);
    }
    setLoading(false);
  }, [page, actionFilter, q]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[.16em] text-clay">AUDIT</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">سجل المنشورات</h2>
          <p className="mt-1 text-sm text-ink/45">
            من أضاف أو نشر أو راجع ماذا ومتى. يظهر هذا السجل فقط للمسؤول والمالك.
          </p>
        </div>
        <span className="rounded-full bg-olive/7 px-3 py-1 text-xs font-black text-olive-dark">
          {count.toLocaleString("ar")} حدث
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_240px]">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="ابحث بعنوان المادة أو اسم/بريد الفاعل..."
          className={INPUT_CLASS}
        />
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLASS}
        >
          <option value="">كل أنواع الأحداث</option>
          {Object.entries(ACTIVITY_ACTION_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 space-y-2">
        {items.map((x) => (
          <div key={x.id} className="rounded-2xl border border-olive/10 bg-[#fbfaf7] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-olive-dark">
                  {x.actor_name || x.actor_email || "مستخدم محذوف"}
                </p>
                <p className="mt-1 text-xs text-ink/55">
                  {ACTIVITY_ACTION_LABELS[x.action] || x.action}
                  {x.title_ar ? ` · ${x.title_ar}` : ""}
                </p>
              </div>
              <p className="text-xs text-ink/40">
                {new Date(x.created_at).toLocaleString("ar")}
              </p>
            </div>
          </div>
        ))}
        {!loading && !items.length && (
          <div className="rounded-2xl border border-dashed border-olive/15 p-12 text-center text-sm text-ink/40">
            لا توجد أحداث مطابقة للفلتر الحالي.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between border-t border-olive/10 pt-4 text-xs font-bold">
          <span>
            صفحة {page} من {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-olive/10 px-3 py-1.5 disabled:opacity-40"
            >
              السابق
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-olive/10 px-3 py-1.5 disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
