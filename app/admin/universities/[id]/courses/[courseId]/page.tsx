"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AuthGate, { logoutAdmin } from "../../../../AuthGate";
import { AdminShell, Modal } from "../../../../AdminShell";
import {
  MATERIAL_TYPE_LABELS,
  type Course,
  type Material,
  type University,
} from "@/lib/types";
import MaterialAdminForm from "@/components/MaterialAdminForm";
import { authFetch } from "@/lib/authFetch";

export default function CourseAdminPage() {
  return (
    <AuthGate>
      <CourseWorkspace />
    </AuthGate>
  );
}

function CourseWorkspace() {
  const { id, courseId } = useParams<{ id: string; courseId: string }>();
  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | Material | null>(null);

  const uni = universities.find((u) => u.id === id);
  const course = courses.find((c) => c.id === courseId);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, m] = await Promise.all([
      authFetch("/api/admin/taxonomy"),
      authFetch(`/api/admin/materials?course_id=${encodeURIComponent(courseId)}&pageSize=50`),
    ]);
    if (t.ok) {
      const d = await t.json();
      setUniversities(d.universities || []);
      setCourses(d.courses || []);
    }
    if (m.ok) {
      const d = await m.json();
      setMaterials(d.items || []);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  async function del(materialId: string) {
    if (!confirm("حذف هذا المنشور؟ سيتم حذف ملفه من Google Drive أيضًا.")) return;
    const r = await authFetch(`/api/admin/materials?id=${encodeURIComponent(materialId)}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      alert("تعذر الحذف");
      return;
    }
    load();
  }

  return (
    <AdminShell>
      <header className="rounded-[32px] bg-olive p-6 text-parchment shadow-soft sm:p-9">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-parchment/55">
              <Link href="/admin" className="hover:text-parchment">
                الجامعات
              </Link>
              <span>/</span>
              <Link href={`/admin/universities/${id}`} className="hover:text-parchment">
                {uni?.name_ar || "..."}
              </Link>
            </div>
            <div className="mt-5 text-xs font-black tracking-[0.2em] text-gold-light">
              المستوى 2 · المساق
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold">
              {course?.name_ar || (loading ? "..." : "غير موجود")}
            </h1>
            <p className="mt-2 text-sm text-parchment/60">
              {course?.code ? `رمز المساق: ${course.code}` : "بدون رمز"} · كل المنشورات الخاصة بهذا
              المساق.
            </p>
          </div>
          <button
            onClick={logoutAdmin}
            className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black ring-1 ring-white/10"
          >
            تسجيل الخروج
          </button>
        </div>
      </header>

      <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[.16em] text-clay">المنشورات</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">
              {materials.length} منشور
            </h2>
          </div>
          <button
            onClick={() => setModal("add")}
            className="rounded-2xl bg-clay px-5 py-3 font-black text-parchment hover:bg-clay-dark"
          >
            + إضافة منشور لهذا المساق
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[750px] text-right">
            <thead>
              <tr className="border-b border-olive/10 text-xs font-black text-ink/40">
                <th className="p-3">المنشور</th>
                <th className="p-3">النوع</th>
                <th className="p-3">التحميلات</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-b border-olive/5">
                  <td className="p-3 font-bold">
                    {m.title_ar}
                    {m.is_verified && (
                      <span className="mr-2 rounded-full bg-emerald-700/10 px-2 py-0.5 text-[10px] font-black text-emerald-900">
                        موثّق ✓
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs font-black">{MATERIAL_TYPE_LABELS[m.type]}</td>
                  <td className="p-3 text-sm font-black">
                    {m.downloads_count.toLocaleString("ar")}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setModal(m)}
                      className="ml-2 rounded-xl border border-olive/10 px-3 py-2 text-xs font-black"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => del(m.id)}
                      className="rounded-xl border border-clay/15 px-3 py-2 text-xs font-black text-clay-dark"
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !materials.length && (
            <p className="p-10 text-center text-sm text-ink/40">
              لا توجد منشورات في هذا المساق بعد.
            </p>
          )}
        </div>
      </section>

      {modal && (
        <Modal
          title={modal === "add" ? "إضافة منشور" : "تعديل منشور"}
          onClose={() => setModal(null)}
        >
          <MaterialAdminForm
            courseId={courseId}
            existing={modal === "add" ? undefined : modal}
            onSaved={() => {
              setModal(null);
              load();
            }}
          />
        </Modal>
      )}
    </AdminShell>
  );
}
