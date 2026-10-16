"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Course, University } from "@/lib/types";
import { Modal } from "../AdminShell";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/components/AuthProvider";
import { INPUT_CLASS } from "@/lib/styles";

interface TaxonomyData {
  universities: University[];
  courses: Course[];
}

export default function UniversityDirectoryTab() {
  const [data, setData] = useState<TaxonomyData>({ universities: [], courses: [] });
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [editing, setEditing] = useState<University | null>(null);
  const [editName, setEditName] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [deletingUni, setDeletingUni] = useState<University | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  const { profile } = useAuth();
  // مسؤول الجامعة لا يضيف/يعدّل/يحذف الجامعات نفسها، بل يدير مساقاتها ومحتواها فقط
  const canManageUniversities = profile?.role === "admin" || profile?.role === "owner";

  async function load() {
    const r = await authFetch("/api/admin/taxonomy");
    if (r.ok) setData(await r.json());
  }

  useEffect(() => {
    load();
  }, []);

  const list = useMemo(
    () => data.universities.filter((u) => u.name_ar.includes(q.trim())),
    [data.universities, q]
  );

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await authFetch("/api/admin/taxonomy", {
      method: "POST",
      body: JSON.stringify({ kind: "university", name_ar: name.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setMessage(d.error || "تعذر الإضافة");
      return;
    }
    setName("");
    setShowAdd(false);
    setMessage("تمت إضافة الجامعة بنجاح");
    load();
  }

  function openEdit(u: University, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditing(u);
    setEditName(u.name_ar);
  }

  async function saveEdit() {
    if (!editing || !editName.trim()) return;
    setEditBusy(true);
    const r = await authFetch("/api/admin/taxonomy", {
      method: "PATCH",
      body: JSON.stringify({ kind: "university", id: editing.id, name_ar: editName.trim() }),
    });
    const d = await r.json().catch(() => ({}));
    setEditBusy(false);
    if (!r.ok) {
      alert(d.error || "تعذر حفظ التعديل");
      return;
    }
    setEditing(null);
    load();
  }

  function openDeleteModal(u: University, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingUni(u);
    setConfirmName("");
  }

  async function confirmDeleteUniversity() {
    if (!deletingUni || confirmName.trim() !== deletingUni.name_ar.trim()) return;
    setDelBusy(true);
    const r = await authFetch(
      `/api/admin/taxonomy?id=${encodeURIComponent(deletingUni.id)}&kind=university`,
      { method: "DELETE" }
    );
    const d = await r.json().catch(() => ({}));
    setDelBusy(false);
    if (!r.ok) {
      alert(d.error || "تعذر الحذف");
      return;
    }
    setDeletingUni(null);
    setConfirmName("");
    load();
  }

  return (
    <>
      <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink/35">
              ⌕
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن الجامعة..."
              className={`${INPUT_CLASS} pr-11`}
            />
          </div>
          {canManageUniversities && (
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-2xl bg-clay px-5 py-3 font-black text-parchment hover:bg-clay-dark"
            >
              + إضافة جامعة
            </button>
          )}
        </div>
        {message && (
          <div className="mt-4 rounded-2xl bg-olive/5 px-4 py-3 text-sm font-bold text-olive-dark">
            {message}
          </div>
        )}
      </section>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((u) => {
          const uniCourseCount = data.courses.filter((c) => c.university_id === u.id).length;
          return (
            <Link
              key={u.id}
              href={`/admin/universities/${u.id}`}
              className="group rounded-[26px] border border-olive/10 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-soft"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-olive/7 text-xl text-olive-dark">
                  ⌂
                </span>
                <span className="flex items-center gap-3">
                  {canManageUniversities && (
                    <>
                      <button
                        onClick={(e) => openEdit(u, e)}
                        className="text-xs font-black text-ink/40 opacity-0 transition hover:text-olive-dark group-hover:opacity-100"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={(e) => openDeleteModal(u, e)}
                        className="text-xs font-black text-clay-dark opacity-0 transition hover:text-clay group-hover:opacity-100"
                      >
                        حذف
                      </button>
                    </>
                  )}
                  <span className="text-xs font-black text-clay opacity-0 transition group-hover:opacity-100">
                    فتح الإدارة ←
                  </span>
                </span>
              </div>
              <h2 className="mt-5 font-display text-xl font-bold text-olive-dark">{u.name_ar}</h2>
              <p className="mt-2 text-sm leading-6 text-ink/45">
                {uniCourseCount} مساق مسجّل · إدارة المساقات والمواد الخاصة بهذه الجامعة.
              </p>
            </Link>
          );
        })}

        {!list.length && (
          <div className="rounded-[26px] border border-dashed border-olive/15 bg-white p-12 text-center text-sm text-ink/45 lg:col-span-3">
            لا توجد جامعة مطابقة للبحث.
          </div>
        )}
      </section>

      {showAdd && (
        <Modal title="إضافة جامعة" onClose={() => setShowAdd(false)}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="اسم الجامعة"
            className={INPUT_CLASS}
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={add}
              disabled={busy}
              className="flex-1 rounded-2xl bg-olive px-4 py-3 font-black text-parchment"
            >
              {busy ? "جارٍ الإضافة..." : "إضافة الجامعة"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-2xl border border-olive/10 px-4 py-3 font-black"
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title="تعديل اسم الجامعة" onClose={() => setEditing(null)}>
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
            }}
            placeholder="اسم الجامعة"
            className={INPUT_CLASS}
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={saveEdit}
              disabled={editBusy}
              className="flex-1 rounded-2xl bg-olive px-4 py-3 font-black text-parchment"
            >
              {editBusy ? "جارٍ الحفظ..." : "حفظ التعديل"}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-2xl border border-olive/10 px-4 py-3 font-black"
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {deletingUni && (
        <Modal title="تأكيد حذف الجامعة نهائيًا" onClose={() => setDeletingUni(null)}>
          <div className="rounded-2xl border border-clay/25 bg-clay/5 p-4 text-xs leading-6 text-clay-dark">
            <p className="font-black">⚠️ تحذير خطير:</p>
            <p className="mt-1">
              حذف جامعة <strong>«{deletingUni.name_ar}»</strong> سيؤدي إلى حذف جميع مساقاتها وكافة
              المواد والملخصات والامتحانات المرتبطة بها نهائيًا.
            </p>
          </div>
          <label className="mt-4 block text-xs font-bold text-ink/70">
            لتأكيد الحذف، اكتب اسم الجامعة كما هو بالضبط:{" "}
            <span className="font-black text-olive-dark">{deletingUni.name_ar}</span>
            <input
              autoFocus
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={deletingUni.name_ar}
              className={`mt-2 ${INPUT_CLASS}`}
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={delBusy || confirmName.trim() !== deletingUni.name_ar.trim()}
              onClick={confirmDeleteUniversity}
              className="flex-1 rounded-2xl bg-clay px-4 py-3 text-sm font-black text-parchment hover:bg-clay-dark disabled:opacity-40"
            >
              {delBusy ? "جارٍ الحذف..." : "تأكيد الحذف النهائي"}
            </button>
            <button
              type="button"
              onClick={() => setDeletingUni(null)}
              className="rounded-2xl border border-olive/10 px-4 py-3 text-sm font-black"
            >
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
