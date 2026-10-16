"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS, SELECT_CLASS } from "@/lib/styles";
import { whatsappLink } from "@/lib/phone";
import { canManageTarget, roleLabel, type UserRole } from "@/lib/roles";

interface MemberProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  whatsapp: string | null;
  university_id: string | null;
  managed_university_id: string | null;
  universities?: { name_ar?: string } | null;
  managed_university?: { name_ar?: string } | null;
  created_at: string;
}

const PAGE_SIZE = 25;

export default function MembersTab() {
  const [users, setUsers] = useState<MemberProfile[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actor, setActor] = useState<UserRole>("user");
  const [scoped, setScoped] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (q.trim()) params.set("q", q.trim());
    if (roleFilter) params.set("role", roleFilter);

    const r = await authFetch(`/api/admin/users?${params.toString()}`);
    if (r.ok) {
      const d = await r.json();
      setUsers(d.users || []);
      setCount(d.count ?? (d.users || []).length);
      setActor((d.actorRole || "user") as UserRole);
      setScoped(Boolean(d.scopeUniversityId));
    }
  }, [page, q, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(u: MemberProfile, role: string) {
    if (role === u.role) return;
    if (role === "uni_admin") {
      if (!u.university_id) {
        alert("لا يمكن تعيينه مسؤول جامعة قبل أن يختار جامعته في ملفه الشخصي.");
        return;
      }
      const uniName = u.universities?.name_ar || "جامعته";
      if (!confirm(`تعيين «${u.full_name || u.email}» مسؤولًا عن (${uniName}) فقط؟`)) return;
    }
    const id = u.id;
    setBusy(id);
    const r = await authFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ id, role, university_id: role === "uni_admin" ? u.university_id : undefined }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      alert(d.error || "تعذر تغيير الصلاحية");
      return;
    }
    load();
  }

  async function removeUser(u: MemberProfile) {
    if (
      !confirm(
        `حذف حساب «${u.full_name || u.email}» نهائيًا؟ ستبقى مساهماته المؤرشفة محفوظة باسمه دون حذفها.`
      )
    )
      return;
    setBusy(u.id);
    const r = await authFetch(`/api/admin/users?id=${encodeURIComponent(u.id)}`, {
      method: "DELETE",
    });
    const d = await r.json().catch(() => ({}));
    setBusy("");
    if (!r.ok) {
      alert(d.error || "تعذر حذف المستخدم");
      return;
    }
    load();
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[.16em] text-clay">MEMBERS</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">
            الأعضاء والصلاحيات
          </h2>
          <p className="mt-1 text-sm text-ink/45">
            {scoped
              ? "تظهر لك أعضاء جامعتك فقط، ولا يمكنك تعديل صلاحيات أي عضو أو مسؤول."
              : "الصلاحية الافتراضية لكل حساب جديد: مستخدم عادي."}
          </p>
        </div>
        <span className="rounded-full bg-olive/7 px-3 py-1 text-xs font-black text-olive-dark">
          {count.toLocaleString("ar")} عضو
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="ابحث بالاسم أو البريد أو رقم الهاتف..."
          className={INPUT_CLASS}
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className={SELECT_CLASS}
        >
          <option value="">كل الصلاحيات</option>
          <option value="owner">المالك</option>
          <option value="admin">المسؤولون</option>
          <option value="uni_admin">مسؤولو الجامعات</option>
          <option value="user">المستخدمون العاديون</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[1100px] text-right">
          <thead>
            <tr className="border-b border-olive/10 text-xs font-black text-ink/40">
              <th className="p-3">العضو</th>
              <th className="p-3">البريد</th>
              <th className="p-3">الجامعة</th>
              <th className="p-3">الهاتف</th>
              <th className="p-3">واتساب</th>
              <th className="p-3">الصلاحية</th>
              <th className="p-3">تاريخ التسجيل</th>
              <th className="p-3">تغيير الصلاحية</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-olive/5">
                <td className="p-3 font-bold">{u.full_name || "بدون اسم"}</td>
                <td className="p-3 text-sm">{u.email}</td>
                <td className="p-3 text-sm">
                  {u.universities?.name_ar || (
                    <span className="text-xs font-bold text-clay-dark">لم تُحدد</span>
                  )}
                </td>
                <td className="p-3 text-sm" dir="ltr">
                  {u.phone ? (
                    <span className="text-right">{u.phone}</span>
                  ) : (
                    <span className="text-xs font-bold text-clay-dark">لم يُدخل</span>
                  )}
                </td>
                <td className="p-3 text-sm" dir="ltr">
                  {whatsappLink(u.whatsapp) ? (
                    <a
                      href={whatsappLink(u.whatsapp) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-olive-light hover:underline"
                    >
                      {u.whatsapp}
                    </a>
                  ) : (
                    <span className="text-xs font-bold text-clay-dark">لم يُدخل</span>
                  )}
                </td>
                <td className="p-3">
                  <span className="rounded-full bg-olive/7 px-3 py-1 text-xs font-black">
                    {roleLabel(u.role, u.managed_university?.name_ar)}
                  </span>
                </td>
                <td className="p-3 text-xs text-ink/45">
                  {new Date(u.created_at).toLocaleDateString("ar")}
                </td>
                <td className="p-3">
                  {!canManageTarget(actor, u.role) ? (
                    <span className="text-xs font-bold text-ink/35">
                      {u.role === "owner" ? "محمي" : "—"}
                    </span>
                  ) : (
                    <select
                      disabled={busy === u.id}
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="rounded-xl border border-olive/10 bg-[#fbfaf7] px-3 py-2 text-xs font-bold"
                    >
                      {actor === "owner" && <option value="owner">مالك</option>}
                      <option value="admin">مسؤول</option>
                      <option value="uni_admin">مسؤول جامعة</option>
                      <option value="user">مستخدم عادي</option>
                    </select>
                  )}
                </td>
                <td className="p-3">
                  {u.role === "owner" ||
                  !canManageTarget(actor, u.role) ||
                  ((u.role === "admin" || u.role === "uni_admin") && actor !== "owner") ? (
                    <span className="text-xs text-ink/30">—</span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === u.id}
                      onClick={() => removeUser(u)}
                      className="rounded-xl border border-clay/20 px-3 py-1.5 text-xs font-black text-clay-dark hover:bg-clay/5 disabled:opacity-40"
                    >
                      حذف الحساب
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!users.length && (
          <p className="p-10 text-center text-sm text-ink/40">لا يوجد أعضاء مطابقون للبحث.</p>
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
