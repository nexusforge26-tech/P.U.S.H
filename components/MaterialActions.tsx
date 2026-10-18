"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/types";
import { INPUT_CLASS, SELECT_CLASS } from "@/lib/styles";

interface Props {
  materialId: string;
  materialTitle: string;
  initialHelpfulCount?: number;
}

const BOOKMARKS_KEY = "push_bookmarked_materials";

export default function MaterialActions({
  materialId,
  materialTitle,
  initialHelpfulCount = 0,
}: Props) {
  const [helpfulCount, setHelpfulCount] = useState(initialHelpfulCount);
  const [voted, setVoted] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("broken_link");
  const [details, setDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState("");
  const [reportErr, setReportErr] = useState("");

  useEffect(() => {
    try {
      const votedKey = `push_voted_${materialId}`;
      if (localStorage.getItem(votedKey)) setVoted(true);

      const saved = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]") as { id: string }[];
      setBookmarked(saved.some((x) => x.id === materialId));
    } catch {
      // تجاهل
    }
  }, [materialId]);

  async function handleHelpful() {
    if (voted) return;
    setVoted(true);
    setHelpfulCount((c) => c + 1);
    try {
      localStorage.setItem(`push_voted_${materialId}`, "1");
      const res = await authFetch(`/api/materials/${encodeURIComponent(materialId)}/helpful`, {
        method: "POST",
      });
      if (res.status === 401) {
        // التصويت يتطلب حسابًا: نتراجع عن التحديث المتفائل ونوجّه المستخدم لتسجيل الدخول.
        localStorage.removeItem(`push_voted_${materialId}`);
        setVoted(false);
        setHelpfulCount((c) => Math.max(0, c - 1));
        window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (typeof data.helpful_count === "number") {
          setHelpfulCount(data.helpful_count);
        }
      } else {
        localStorage.removeItem(`push_voted_${materialId}`);
        setVoted(false);
        setHelpfulCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // تجاهل
    }
  }

  function toggleBookmark() {
    try {
      const saved = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || "[]") as {
        id: string;
        title_ar: string;
        savedAt: string;
      }[];
      const exists = saved.some((x) => x.id === materialId);
      const next = exists
        ? saved.filter((x) => x.id !== materialId)
        : [
            { id: materialId, title_ar: materialTitle, savedAt: new Date().toISOString() },
            ...saved,
          ];
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
      setBookmarked(!exists);
    } catch {
      // تجاهل
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    setReportBusy(true);
    setReportErr("");
    setReportMsg("");

    try {
      const res = await authFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          material_id: materialId,
          reason,
          details,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportErr(data.error || "تعذر إرسال البلاغ");
      } else {
        setReportMsg("تم إرسال البلاغ للإدارة بنجاح. شكرًا لمساهمتك في الحفاظ على جودة المحتوى.");
        setDetails("");
      }
    } catch {
      setReportErr("حدث خطأ في الاتصال");
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={handleHelpful}
          disabled={voted}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition ${
            voted
              ? "border-olive bg-olive/10 text-olive-dark"
              : "border-olive/15 bg-white text-ink/75 hover:border-gold/40 hover:bg-olive/5"
          }`}
        >
          <span>👍</span>
          <span>{voted ? "شكرًا لتقييمك!" : "مفيد"}</span>
          <span className="rounded-full bg-olive/10 px-2 py-0.5 text-[11px] font-black text-olive-dark">
            {helpfulCount}
          </span>
        </button>

        <button
          type="button"
          onClick={toggleBookmark}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition ${
            bookmarked
              ? "border-gold bg-gold/15 text-olive-dark"
              : "border-olive/15 bg-white text-ink/75 hover:border-gold/40"
          }`}
        >
          <span>{bookmarked ? "★" : "☆"}</span>
          <span>{bookmarked ? "محفوظة في مفضلتي" : "حفظ في المفضلة"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setReportOpen(true);
            setReportMsg("");
            setReportErr("");
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-clay/20 bg-white px-4 py-2 text-xs font-bold text-clay-dark transition hover:bg-clay/5"
        >
          <span>⚑</span>
          <span>أبلغ عن مشكلة</span>
        </button>
      </div>

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-olive/35 p-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold text-olive-dark">
                الإبلاغ عن مشكلة في المادة
              </h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-xl px-3 py-2 text-ink/40 hover:bg-olive/5"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-ink/55">المادة: {materialTitle}</p>

            <form onSubmit={submitReport} className="mt-4 space-y-3">
              <label className="block text-xs font-bold text-ink/60">
                سبب البلاغ
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                  className={`mt-1.5 ${SELECT_CLASS}`}
                >
                  {Object.entries(REPORT_REASON_LABELS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-ink/60">
                توضيح إضافي (اختياري)
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="اشرح المشكلة باختصار (مثلًا: الملف لا يفتح، أو يخص مساقًا آخر)..."
                  className={`mt-1.5 ${INPUT_CLASS} resize-none`}
                />
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={reportBusy}
                  className="flex-1 rounded-2xl bg-clay py-3 text-sm font-black text-parchment hover:bg-clay-dark disabled:opacity-50"
                >
                  {reportBusy ? "جارٍ الإرسال..." : "إرسال البلاغ"}
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="rounded-2xl border border-olive/10 px-4 py-3 text-sm font-bold"
                >
                  إغلاق
                </button>
              </div>

              {reportErr && (
                <div className="rounded-2xl bg-clay/5 p-3 text-xs font-bold text-clay-dark">
                  {reportErr}
                </div>
              )}
              {reportMsg && (
                <div className="rounded-2xl bg-olive/5 p-3 text-xs font-bold text-olive-dark">
                  {reportMsg}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
