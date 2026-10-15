"use client";

import { useCallback, useEffect, useState } from "react";
import { DOCTOR_REJECTION_PRESETS, type DoctorSubmission } from "@/lib/types";
import { Modal } from "../AdminShell";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS } from "@/lib/styles";

const STATUS_TABS = [
  { key: "pending", label: "المعلقة" },
  { key: "approved", label: "المقبولة" },
  { key: "rejected", label: "المرفوضة" },
  { key: "all", label: "الكل" },
] as const;

export default function DoctorSubmissionsTab({ onReviewed }: { onReviewed?: () => void }) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [items, setItems] = useState<DoctorSubmission[]>([]);
  const [busy, setBusy] = useState("");
  const [rejectingItem, setRejectingItem] = useState<DoctorSubmission | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    const r = await authFetch(
      `/api/admin/doctor-submissions?status=${encodeURIComponent(statusFilter)}`
    );
    if (r.ok) {
      const d = await r.json();
      setItems(d.submissions || []);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id: string, action: "approve" | "reject", admin_note?: string) {
    setBusy(id);
    const r = await authFetch("/api/admin/doctor-submissions", {
      method: "PATCH",
      body: JSON.stringify({ id, action, admin_note }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      alert(d.error || "تعذر تنفيذ المراجعة");
      return false;
    }
    await load();
    onReviewed?.();
    return true;
  }

  async function confirmReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingItem) return;
    const ok = await review(rejectingItem.id, "reject", rejectNote.trim() || undefined);
    if (ok) {
      setRejectingItem(null);
      setRejectNote("");
    }
  }

  return (
    <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[.16em] text-clay">DOCTORS</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">
            مراجعة معلومات الدكاترة
          </h2>
          <p className="mt-1 text-sm text-ink/45">
            إضافات وتعديلات معلومات الدكاترة لا تُنشر إلا بعد الموافقة، مع عرض الفرق بين القديم
            والمقترح.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-olive/10 bg-[#fbfaf7] p-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusFilter(t.key)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                statusFilter === t.key
                  ? "bg-olive text-parchment"
                  : "text-ink/60 hover:bg-olive/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((x: any) => {
          const isEdit = x.kind === "edit";
          const fields: [string, string][] = [
            ["الاسم الكامل", x.full_name],
            ["البريد الإلكتروني", x.email],
            ["الرقم الخاص", x.phone || "—"],
            ["موقع المكتب", x.office_location || "—"],
            ["الجامعة", x.university_name],
            ["المساقات", (x.courses || []).join("، ") || "—"],
          ];
          const oldFields: Record<string, string> =
            isEdit && x.current
              ? {
                  "الاسم الكامل": x.current.full_name,
                  "البريد الإلكتروني": x.current.email,
                  "الرقم الخاص": x.current.phone || "—",
                  "موقع المكتب": x.current.office_location || "—",
                  الجامعة: x.current.universities?.name_ar || "—",
                  المساقات: (x.current.courses || []).join("، ") || "—",
                }
              : {};

          return (
            <article key={x.id} className="rounded-2xl border border-olive/10 bg-[#fbfaf7] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-olive-dark">{x.full_name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                        isEdit ? "bg-gold/15 text-olive-dark" : "bg-olive/10 text-olive-dark"
                      }`}
                    >
                      {isEdit ? "تعديل دكتور موجود" : "دكتور جديد"}
                    </span>
                    {x.status !== "pending" && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                          x.status === "approved"
                            ? "bg-emerald-700/15 text-emerald-900"
                            : "bg-clay/15 text-clay-dark"
                        }`}
                      >
                        {x.status === "approved" ? "مقبول" : "مرفوض"}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-ink/45">
                    بواسطة {x.user_name || x.submitter_account_email || "مستخدم"} ·{" "}
                    {new Date(x.created_at).toLocaleString("ar")}
                  </p>

                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {fields.map(([label, val]) => {
                      const oldVal = oldFields[label];
                      const changed = isEdit && oldVal !== undefined && oldVal !== val;
                      return (
                        <div key={label} className="text-xs leading-6">
                          <span className="font-bold text-ink/50">{label}: </span>
                          {changed ? (
                            <>
                              <span className="text-clay-dark line-through">{oldVal}</span>
                              <span className="mx-1 text-ink/30">←</span>
                              <span className="font-bold text-olive-dark">{val}</span>
                            </>
                          ) : (
                            <span className="text-ink/70">{val}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {x.status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={busy === x.id}
                      onClick={() => review(x.id, "approve")}
                      className="rounded-xl bg-olive px-4 py-2 text-xs font-black text-parchment hover:bg-olive-dark"
                    >
                      {isEdit ? "قبول التعديل" : "قبول ونشر"}
                    </button>
                    <button
                      disabled={busy === x.id}
                      onClick={() => {
                        setRejectingItem(x);
                        setRejectNote("");
                      }}
                      className="rounded-xl border border-clay/15 bg-white px-4 py-2 text-xs font-black text-clay-dark hover:bg-clay/5"
                    >
                      رفض
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {!items.length && (
          <div className="rounded-2xl border border-dashed border-olive/15 p-12 text-center text-sm text-ink/40">
            لا توجد مساهمات في هذا التبويب حاليًا.
          </div>
        )}
      </div>

      {rejectingItem && (
        <Modal title="رفض مساهمة معلومات الدكتور" onClose={() => setRejectingItem(null)}>
          <form onSubmit={confirmReject} className="space-y-3">
            <div className="flex flex-col gap-1.5">
              {DOCTOR_REJECTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setRejectNote(preset)}
                  className={`rounded-xl border px-3 py-2 text-right text-xs font-bold transition ${
                    rejectNote === preset
                      ? "border-clay bg-clay/10 text-clay-dark"
                      : "border-olive/10 bg-[#fbfaf7] text-ink/70 hover:border-gold/40"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="سبب الرفض (اختياري)..."
              className={`${INPUT_CLASS} resize-none`}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={busy === rejectingItem.id}
                className="flex-1 rounded-2xl bg-clay py-3 text-sm font-black text-parchment hover:bg-clay-dark"
              >
                تأكيد الرفض
              </button>
              <button
                type="button"
                onClick={() => setRejectingItem(null)}
                className="rounded-2xl border border-olive/10 px-4 py-3 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
