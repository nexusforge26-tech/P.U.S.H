"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACADEMIC_YEAR_OPTIONS,
  MATERIAL_TYPE_LABELS,
  REJECTION_REASON_PRESETS,
  SEMESTER_LABELS,
  type Course,
  type MaterialType,
  type Submission,
} from "@/lib/types";
import { toDrivePreviewUrl } from "@/lib/validation";
import { youtubeThumb } from "@/lib/youtube";
import { formatBytes } from "@/lib/uploadLimits";
import { Modal } from "../AdminShell";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS, SELECT_CLASS } from "@/lib/styles";

const STATUS_FILTER_TABS = [
  { key: "pending", label: "المعلقة" },
  { key: "approved", label: "المقبولة" },
  { key: "rejected", label: "المرفوضة" },
  { key: "all", label: "الكل (السجل)" },
] as const;

export default function SubmissionsTab({ onReviewed }: { onReviewed?: () => void }) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [items, setItems] = useState<Submission[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [busy, setBusy] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [editingSub, setEditingSub] = useState<Submission | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [editSem, setEditSem] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editVerified, setEditVerified] = useState(true);

  const [rejectingSub, setRejectingSub] = useState<Submission | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    const [subRes, taxRes] = await Promise.all([
      authFetch(`/api/admin/submissions?status=${encodeURIComponent(statusFilter)}`),
      authFetch("/api/admin/taxonomy"),
    ]);
    if (subRes.ok) {
      const d = await subRes.json();
      setItems(d.submissions || []);
      setSelectedIds([]);
    }
    if (taxRes.ok) {
      const t = await taxRes.json();
      setCourses(t.courses || []);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function executeReview(
    id: string,
    action: "approve" | "reject",
    admin_note?: string,
    overrides?: Record<string, unknown>
  ) {
    setBusy(id);
    const r = await authFetch("/api/admin/submissions", {
      method: "PATCH",
      body: JSON.stringify({ id, action, admin_note, overrides }),
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

  async function bulkApprove() {
    if (selectedIds.length === 0) return;
    setBusy("bulk");
    const r = await authFetch("/api/admin/submissions", {
      method: "PATCH",
      body: JSON.stringify({ ids: selectedIds, action: "approve" }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      alert(d.error || "تعذر تنفيذ القبول الجماعي");
      return;
    }
    await load();
    onReviewed?.();
  }

  function openEditBeforeApprove(sub: Submission) {
    setEditingSub(sub);
    setEditTitle(sub.kind === "course" ? sub.suggested_course_name || "" : sub.title_ar || "");
    setEditDesc(sub.description_ar || "");
    setEditCourseId(sub.course_id || "");
    setEditSem(sub.semester || "");
    setEditYear(sub.academic_year || "");
    setEditVerified(true);
  }

  async function confirmEditedApproval(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSub) return;
    const ok = await executeReview(editingSub.id, "approve", undefined, {
      title_ar: editTitle.trim(),
      description_ar: editDesc.trim() || null,
      course_id: editCourseId || editingSub.course_id,
      semester: editSem || null,
      academic_year: editYear || null,
      is_verified: editVerified,
    });
    if (ok) setEditingSub(null);
  }

  async function confirmReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingSub) return;
    const ok = await executeReview(rejectingSub.id, "reject", rejectNote.trim() || undefined);
    if (ok) {
      setRejectingSub(null);
      setRejectNote("");
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const pendingItems = items.filter((x) => x.status === "pending");

  return (
    <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[.16em] text-clay">SUBMISSIONS REVIEW</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">
            مراجعة مساهمات الأعضاء
          </h2>
          <p className="mt-1 text-sm text-ink/45">
            عاين الملف وتفاصيله الكاملة أو عدّل العنوان والمساق قبل القبول والنشر.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-olive/10 bg-[#fbfaf7] p-1.5">
          {STATUS_FILTER_TABS.map((t) => (
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

      {statusFilter === "pending" && pendingItems.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive/10 bg-olive/5 px-4 py-2.5 text-xs">
          <label className="flex cursor-pointer items-center gap-2 font-bold text-olive-dark">
            <input
              type="checkbox"
              checked={selectedIds.length === pendingItems.length && pendingItems.length > 0}
              onChange={(e) =>
                setSelectedIds(e.target.checked ? pendingItems.map((x) => x.id) : [])
              }
            />
            <span>تحديد الكل ({selectedIds.length} محدد)</span>
          </label>
          {selectedIds.length > 0 && (
            <button
              type="button"
              disabled={busy === "bulk"}
              onClick={bulkApprove}
              className="rounded-xl bg-olive px-4 py-2 font-black text-parchment hover:bg-olive-dark disabled:opacity-50"
            >
              {busy === "bulk" ? "جارٍ القبول..." : `قبول ونشر المحدد (${selectedIds.length})`}
            </button>
          )}
        </div>
      )}

      <div className="mt-5 space-y-4">
        {items.map((x) => {
          const isCourse = x.kind === "course";
          const isEdit = x.kind === "material_edit";
          const isVideo = x.type === "video";
          const drivePreview = !isCourse && !isVideo ? toDrivePreviewUrl(x.drive_link) : null;
          const externalHref = isVideo
            ? x.youtube_id
              ? `https://www.youtube.com/watch?v=${x.youtube_id}`
              : null
            : x.drive_link;
          const isPreviewOpen = previewId === x.id;

          return (
            <article
              key={x.id}
              className="rounded-2xl border border-olive/10 bg-[#fbfaf7] p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex flex-1 items-start gap-3">
                  {x.status === "pending" && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(x.id)}
                      onChange={() => toggleSelect(x.id)}
                      className="mt-1.5 h-4 w-4 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                          isCourse
                            ? "bg-gold/20 text-olive-dark"
                            : isEdit
                            ? "bg-clay/15 text-clay-dark"
                            : "bg-olive/10 text-olive-dark"
                        }`}
                      >
                        {isCourse
                          ? "اقتراح مساق جديد"
                          : isEdit
                          ? "تعديل ملف مادة منشورة"
                          : MATERIAL_TYPE_LABELS[x.type as MaterialType] || x.type}
                      </span>

                      {x.semester && (
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink/60">
                          {SEMESTER_LABELS[x.semester] || x.semester}
                        </span>
                      )}
                      {x.academic_year && (
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink/60">
                          العام: {x.academic_year}
                        </span>
                      )}
                      {x.file_size && x.file_size > 0 && (
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ink/60">
                          {formatBytes(x.file_size)}
                        </span>
                      )}
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

                    <h3 className="mt-2 font-display text-lg font-bold text-olive-dark">
                      {isCourse
                        ? `${x.suggested_course_name} (${x.suggested_course_code})`
                        : x.title_ar}
                    </h3>

                    <p className="mt-1 text-xs font-medium text-ink/60">
                      {isCourse ? (
                        <>الجامعة: {x.university_name}</>
                      ) : (
                        <>
                          المساق: <span className="font-bold">{x.course_name}</span>
                          {x.course_code ? ` (${x.course_code})` : ""} · {x.university_name}
                        </>
                      )}
                    </p>

                    {x.description_ar && (
                      <p className="mt-2 rounded-xl bg-white/80 p-3 text-xs leading-6 text-ink/75">
                        {x.description_ar}
                      </p>
                    )}

                    {x.duplicate_warning && (
                      <div className="mt-2.5 rounded-xl border border-gold/40 bg-gold/15 px-3 py-2 text-xs font-bold text-olive-dark">
                        ⚠️ تحذير تكرار: توجد مادة بنفس العنوان أو عنوان مشابه في هذا المساق:{" "}
                        <span className="underline">{(x.duplicate_titles || []).join("، ")}</span>
                      </div>
                    )}

                    {!isCourse && externalHref && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a
                          href={externalHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-olive/15 bg-white px-3 py-1.5 text-xs font-bold text-olive-dark hover:bg-olive/5"
                        >
                          <span>افتح الملف في نافذة جديدة</span>
                          <span>↗</span>
                        </a>

                        {(drivePreview || (isVideo && x.youtube_id)) && (
                          <button
                            type="button"
                            onClick={() => setPreviewId(isPreviewOpen ? null : x.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-bold text-olive-dark hover:bg-gold/20"
                          >
                            <span>{isPreviewOpen ? "إخفاء المعاينة" : "معاينة مدمجة للملف"}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {isVideo && x.youtube_id && !isPreviewOpen && (
                      <div className="mt-3 flex items-center gap-3">
                        <img
                          src={youtubeThumb(x.youtube_id)}
                          alt={x.title_ar}
                          className="h-16 w-28 rounded-xl border border-olive/10 object-cover"
                        />
                        <span className="text-xs text-ink/50" dir="ltr">
                          YouTube ID: {x.youtube_id}
                        </span>
                      </div>
                    )}

                    {isPreviewOpen && (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-olive/15 bg-black">
                        {isVideo && x.youtube_id ? (
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${x.youtube_id}`}
                            title={x.title_ar}
                            className="aspect-video w-full border-0"
                            allowFullScreen
                          />
                        ) : drivePreview ? (
                          <iframe
                            src={drivePreview}
                            title={x.title_ar}
                            className="h-[440px] w-full border-0 bg-white"
                            sandbox="allow-scripts allow-same-origin allow-popups"
                          />
                        ) : null}
                      </div>
                    )}

                    <p className="mt-3 text-[11px] text-ink/45">
                      المرسل: {x.user_name || x.email || "مستخدم"} ({x.email || "—"}) ·{" "}
                      {new Date(x.created_at).toLocaleString("ar")}
                    </p>

                    {x.admin_note && (
                      <p className="mt-1 text-xs font-bold text-clay-dark">
                        ملاحظة المراجعة: {x.admin_note}
                      </p>
                    )}
                  </div>
                </div>

                {x.status === "pending" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      disabled={busy === x.id}
                      onClick={() => executeReview(x.id, "approve")}
                      className="rounded-xl bg-olive px-4 py-2 text-xs font-black text-parchment hover:bg-olive-dark disabled:opacity-50"
                    >
                      قبول ونشر
                    </button>
                    <button
                      disabled={busy === x.id}
                      onClick={() => openEditBeforeApprove(x)}
                      className="rounded-xl border border-olive/15 bg-white px-3.5 py-2 text-xs font-black text-olive-dark hover:bg-olive/5"
                    >
                      تعديل ثم قبول
                    </button>
                    <button
                      disabled={busy === x.id}
                      onClick={() => {
                        setRejectingSub(x);
                        setRejectNote("");
                      }}
                      className="rounded-xl border border-clay/20 bg-white px-4 py-2 text-xs font-black text-clay-dark hover:bg-clay/5"
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

      {editingSub && (
        <Modal title="تعديل البيانات قبل القبول والنشر" onClose={() => setEditingSub(null)}>
          <form onSubmit={confirmEditedApproval} className="space-y-3">
            <label className="block text-xs font-bold text-ink/60">
              {editingSub.kind === "course" ? "اسم المساق" : "عنوان المادة"}
              <input
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={`mt-1 ${INPUT_CLASS}`}
              />
            </label>

            {editingSub.kind !== "course" && (
              <>
                <label className="block text-xs font-bold text-ink/60">
                  المساق
                  <select
                    value={editCourseId}
                    onChange={(e) => setEditCourseId(e.target.value)}
                    className={`mt-1 ${SELECT_CLASS}`}
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_ar} {c.code ? `(${c.code})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs font-bold text-ink/60">
                  الوصف
                  <textarea
                    rows={3}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className={`mt-1 ${INPUT_CLASS} resize-none`}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={editSem}
                    onChange={(e) => setEditSem(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">الفصل الدراسي</option>
                    {Object.entries(SEMESTER_LABELS).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>

                  <select
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">العام الدراسي</option>
                    {ACADEMIC_YEAR_OPTIONS.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 rounded-2xl border border-olive/10 p-3 text-xs font-bold text-olive-dark">
                  <input
                    type="checkbox"
                    checked={editVerified}
                    onChange={(e) => setEditVerified(e.target.checked)}
                  />
                  <span>منح شارة «موثّق من الإدارة ✓»</span>
                </label>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={busy === editingSub.id}
                className="flex-1 rounded-2xl bg-olive py-3 text-sm font-black text-parchment"
              >
                حفظ التعديلات وقبول النشر
              </button>
              <button
                type="button"
                onClick={() => setEditingSub(null)}
                className="rounded-2xl border border-olive/10 px-4 py-3 text-sm font-bold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {rejectingSub && (
        <Modal title="رفض المساهمة" onClose={() => setRejectingSub(null)}>
          <form onSubmit={confirmReject} className="space-y-3">
            <p className="text-xs text-ink/60">
              اختر سببًا جاهزًا أو اكتب ملاحظة ستظهر للمساهم في حسابه وإشعاراته:
            </p>
            <div className="flex flex-col gap-1.5">
              {REJECTION_REASON_PRESETS.map((preset) => (
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
              placeholder="أو اكتب سبب الرفض هنا (اختياري)..."
              className={`${INPUT_CLASS} resize-none`}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={busy === rejectingSub.id}
                className="flex-1 rounded-2xl bg-clay py-3 text-sm font-black text-parchment hover:bg-clay-dark"
              >
                تأكيد الرفض
              </button>
              <button
                type="button"
                onClick={() => setRejectingSub(null)}
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
