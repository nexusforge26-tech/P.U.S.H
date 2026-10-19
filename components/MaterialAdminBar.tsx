"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import MaterialAdminForm, { type CourseOption } from "@/components/MaterialAdminForm";
import { authFetch } from "@/lib/authFetch";
import type { Material } from "@/lib/types";

type AdminMaterial = Pick<
  Material,
  | "id"
  | "course_id"
  | "title_ar"
  | "description_ar"
  | "type"
  | "academic_year"
  | "semester"
  | "drive_link"
  | "youtube_id"
  | "is_featured"
  | "is_verified"
  | "file_size"
  | "mime_type"
  | "university_id"
>;

/**
 * شريط أدوات الإدارة في صفحة المادة: يظهر فقط لمن يملك الصلاحية على هذه المادة
 *  - المسؤول والمالك: كل المواد.
 *  - مسؤول الجامعة: مواد جامعته فقط.
 * الإخفاء هنا للتنظيم فقط؛ الحماية الفعلية تتم في /api/admin/materials.
 */
export default function MaterialAdminBar({ material }: { material: AdminMaterial }) {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [courseOptions, setCourseOptions] = useState<CourseOption[] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (loading || !profile) return null;

  const isGlobalStaff = profile.role === "admin" || profile.role === "owner";
  const isScopedStaff =
    profile.role === "uni_admin" &&
    !!profile.managed_university_id &&
    profile.managed_university_id === material.university_id;
  if (!isGlobalStaff && !isScopedStaff) return null;

  async function openEdit() {
    setEditOpen(true);
    if (courseOptions) return;
    try {
      const r = await authFetch("/api/admin/taxonomy");
      if (!r.ok) return;
      const d = await r.json();
      const unis: Record<string, string> = Object.fromEntries(
        (d.universities ?? []).map((u: { id: string; name_ar: string }) => [u.id, u.name_ar])
      );
      setCourseOptions(
        (d.courses ?? []).map((c: { id: string; name_ar: string; code: string | null; university_id: string }) => ({
          id: c.id,
          label: `${unis[c.university_id] ?? ""} — ${c.name_ar}${c.code ? ` (${c.code})` : ""}`,
        }))
      );
    } catch {
      // نكمل بدون اختيار المساق
    }
  }

  // PATCH يتطلب كل حقول المادة، لذلك نرسلها كاملة مع تغيير الخانة المطلوبة فقط
  async function patch(changes: { is_verified?: boolean; is_featured?: boolean }, okMessage: string) {
    setBusy(true);
    setMessage("");
    const r = await authFetch("/api/admin/materials", {
      method: "PATCH",
      body: JSON.stringify({
        id: material.id,
        course_id: material.course_id,
        title_ar: material.title_ar,
        description_ar: material.description_ar ?? "",
        type: material.type,
        academic_year: material.academic_year ?? "",
        semester: material.semester ?? "",
        drive_link: material.type === "video" ? "" : material.drive_link ?? "",
        youtube_input: material.type === "video" ? material.youtube_id ?? "" : "",
        is_featured: material.is_featured,
        is_verified: material.is_verified ?? false,
        file_size: material.file_size ?? null,
        mime_type: material.mime_type ?? null,
        ...changes,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error || "تعذر تنفيذ العملية");
      return;
    }
    setMessage(okMessage);
    router.refresh();
  }

  async function remove() {
    if (!confirm("حذف هذه المادة نهائيًا؟ سيتم حذف ملفها من Google Drive أيضًا إن لم تكن مستعملة في مكان آخر.")) return;
    setBusy(true);
    const r = await authFetch(`/api/admin/materials?id=${encodeURIComponent(material.id)}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setMessage(d.error || "تعذر الحذف");
      return;
    }
    router.replace("/browse");
    router.refresh();
  }

  const btn =
    "rounded-xl px-3.5 py-2 text-xs font-black transition disabled:opacity-50 ring-1 ring-white/15";

  return (
    <>
      <div className="mt-5 rounded-3xl bg-olive p-4 text-parchment shadow-soft sm:p-5" role="region" aria-label="أدوات الإدارة">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black tracking-[.14em] text-gold-light">أدوات الإدارة · لا تظهر للزوار</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openEdit} disabled={busy} className={`${btn} bg-clay hover:bg-clay-dark`}>
              ✎ تعديل المادة
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patch(
                  { is_verified: !material.is_verified },
                  material.is_verified ? "أُلغي توثيق المادة." : "تم توثيق المادة."
                )
              }
              className={`${btn} bg-white/10 hover:bg-white/20`}
            >
              {material.is_verified ? "إلغاء التوثيق" : "✓ توثيق"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patch(
                  { is_featured: !material.is_featured },
                  material.is_featured ? "أُزيلت المادة من المميزة." : "أصبحت المادة مميزة."
                )
              }
              className={`${btn} bg-white/10 hover:bg-white/20`}
            >
              {material.is_featured ? "إزالة التمييز" : "★ تمييز"}
            </button>
            {material.university_id && (
              <Link
                href={`/admin/universities/${material.university_id}/courses/${material.course_id}`}
                className={`${btn} bg-white/10 hover:bg-white/20`}
              >
                فتح في لوحة الإدارة
              </Link>
            )}
            <button type="button" disabled={busy} onClick={remove} className={`${btn} bg-red-600/80 hover:bg-red-600`}>
              حذف
            </button>
          </div>
        </div>
        {message && (
          <p role="status" className="mt-3 text-xs font-bold text-parchment/80">
            {message}
          </p>
        )}
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-olive/35 p-5 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold text-olive-dark">تعديل المادة</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                aria-label="إغلاق"
                className="rounded-xl px-3 py-2 text-ink/40 hover:bg-olive/5"
              >
                ✕
              </button>
            </div>
            <div className="mt-5">
              <MaterialAdminForm
                courseId={material.course_id}
                existing={material}
                courseOptions={courseOptions}
                onSaved={() => {
                  setEditOpen(false);
                  setMessage("تم حفظ التعديلات.");
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
