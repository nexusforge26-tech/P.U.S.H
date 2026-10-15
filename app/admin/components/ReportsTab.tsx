"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { REPORT_REASON_LABELS, type MaterialReport, type ReportReason } from "@/lib/types";
import { authFetch } from "@/lib/authFetch";

export default function ReportsTab({ onResolved }: { onResolved?: () => void }) {
  const [statusFilter, setStatusFilter] = useState("open");
  const [reports, setReports] = useState<MaterialReport[]>([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(`/api/admin/reports?status=${encodeURIComponent(statusFilter)}`);
    if (r.ok) {
      const d = await r.json();
      setReports(d.reports || []);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, status: "resolved" | "dismissed") {
    setBusy(id);
    const r = await authFetch("/api/admin/reports", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    });
    setBusy("");
    if (r.ok) {
      await load();
      onResolved?.();
    }
  }

  return (
    <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[.16em] text-clay">REPORTS</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">
            بلاغات المواد وحقوق النشر
          </h2>
          <p className="mt-1 text-sm text-ink/45">
            البلاغات المرسلة من الطلبة حول الروابط المعطلة أو الملفات الخاطئة أو حقوق النشر.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-olive/10 bg-[#fbfaf7] p-1.5">
          {[
            ["open", "المفتوحة"],
            ["resolved", "تمت المعالجة"],
            ["dismissed", "مغلقة"],
            ["all", "الكل"],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatusFilter(k)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                statusFilter === k
                  ? "bg-olive text-parchment"
                  : "text-ink/60 hover:bg-olive/5"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {reports.map((rep) => (
          <article key={rep.id} className="rounded-2xl border border-olive/10 bg-[#fbfaf7] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-clay/15 px-2.5 py-0.5 text-[11px] font-black text-clay-dark">
                    {REPORT_REASON_LABELS[rep.reason as ReportReason] || rep.reason}
                  </span>
                  <Link
                    href={`/material/${rep.material_id}`}
                    target="_blank"
                    className="font-bold text-olive-dark hover:underline"
                  >
                    {rep.material_title || "عرض المادة"} ↗
                  </Link>
                </div>
                {rep.details && (
                  <p className="mt-2 text-xs leading-6 text-ink/75">{rep.details}</p>
                )}
                <p className="mt-2 text-[11px] text-ink/45">
                  {rep.reporter_email ? `المبلّغ: ${rep.reporter_email} · ` : ""}
                  {new Date(rep.created_at).toLocaleString("ar")}
                </p>
              </div>

              {rep.status === "open" && (
                <div className="flex shrink-0 gap-2">
                  <button
                    disabled={busy === rep.id}
                    onClick={() => updateStatus(rep.id, "resolved")}
                    className="rounded-xl bg-olive px-3.5 py-2 text-xs font-black text-parchment"
                  >
                    تمت المعالجة ✓
                  </button>
                  <button
                    disabled={busy === rep.id}
                    onClick={() => updateStatus(rep.id, "dismissed")}
                    className="rounded-xl border border-olive/15 bg-white px-3.5 py-2 text-xs font-bold text-ink/60"
                  >
                    تجاهل
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}

        {!reports.length && (
          <div className="rounded-2xl border border-dashed border-olive/15 p-12 text-center text-sm text-ink/40">
            لا توجد بلاغات في هذا التبويب حاليًا.
          </div>
        )}
      </div>
    </section>
  );
}
