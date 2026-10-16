"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import DriveFileInput from "@/components/DriveFileInput";
import ProfileEditor from "@/components/ProfileEditor";
import {
  ACADEMIC_YEAR_OPTIONS,
  MATERIAL_TYPE_LABELS,
  SELF_EDIT_WINDOW_HOURS,
  SEMESTER_LABELS,
  type Material,
  type MaterialType,
  type NotificationItem,
  type Submission,
} from "@/lib/types";
import {
  FAVORITE_COURSES_KEY,
  type FavoriteCourseItem,
} from "@/components/FavoriteCourseButton";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS } from "@/lib/styles";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from "@/lib/validation";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "تم القبول",
  rejected: "مرفوض",
};

export default function AccountPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [items, setItems] = useState<Submission[]>([]);
  const [myMaterials, setMyMaterials] = useState<(Material & { editable: boolean })[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [favoriteCourses, setFavoriteCourses] = useState<FavoriteCourseItem[]>([]);
  const [bookmarkedMaterials, setBookmarkedMaterials] = useState<
    { id: string; title_ar: string }[]
  >([]);
  const [editing, setEditing] = useState<(Material & { editable: boolean }) | null>(null);
  const [noticeBanner, setNoticeBanner] = useState("");

  const loadAccountData = useCallback(async () => {
    const [subRes, mineRes, notifRes] = await Promise.all([
      authFetch("/api/submissions"),
      authFetch("/api/materials/mine"),
      authFetch("/api/notifications"),
    ]);
    if (subRes.ok) {
      const d = await subRes.json();
      setItems(d.submissions || []);
    }
    if (mineRes.ok) {
      const d = await mineRes.json();
      setMyMaterials(d.items || []);
    }
    if (notifRes.ok) {
      const d = await notifRes.json();
      setNotifications(d.notifications || []);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      window.location.href = `/auth?next=${encodeURIComponent("/account")}`;
      return;
    }
    loadAccountData();
    try {
      setFavoriteCourses(
        JSON.parse(localStorage.getItem(FAVORITE_COURSES_KEY) || "[]") as FavoriteCourseItem[]
      );
      setBookmarkedMaterials(
        JSON.parse(localStorage.getItem("push_bookmarked_materials") || "[]")
      );
    } catch {
      // تجاهل
    }
  }, [loading, user, loadAccountData]);

  async function markAllNotificationsRead() {
    await authFetch("/api/notifications", { method: "PATCH", body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await refreshProfile();
  }

  async function del(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا المنشور؟")) return;
    const r = await authFetch(`/api/materials/mine?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(d.error || "تعذر الحذف");
      return;
    }
    loadAccountData();
  }

  async function logout() {
    await signOut();
    window.location.href = "/";
  }

  if (loading || !user) return <main className="min-h-[70vh] bg-[#f7f5ef]" />;

  const roleLabel =
    profile?.role === "owner" ? "المالك" : profile?.role === "admin" ? "المسؤول" : "مستخدم عادي";
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · ACCOUNT</p>
              <h1 className="mt-2 font-display text-4xl font-bold">
                {profile?.full_name || user.email}
              </h1>
              <p className="mt-2 text-sm text-parchment/60">
                {user.email} · {roleLabel}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/submit"
                className="rounded-2xl bg-gold px-5 py-3 font-black text-olive-dark"
              >
                + إرسال مادة
              </Link>
              <button
                onClick={logout}
                className="rounded-2xl bg-white/10 px-5 py-3 font-black hover:bg-white/15"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>

        {noticeBanner && (
          <div className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm font-bold text-olive-dark">
            {noticeBanner}
          </div>
        )}

        {/* بياناتي: الاسم والهاتف والواتساب والجامعة */}
        <ProfileEditor />

        {/* قسم الإشعارات */}
        {notifications.length > 0 && (
          <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold text-olive-dark">الإشعارات</h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-clay px-2.5 py-0.5 text-xs font-black text-parchment">
                    {unreadCount} غير مقروء
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-xs font-bold text-clay hover:underline"
                >
                  تعليم الكل كمقروء ✓
                </button>
              )}
            </div>
            <div className="mt-4 space-y-2">
              {notifications.slice(0, 8).map((n) => (
                <div
                  key={n.id}
                  className={`flex flex-col justify-between gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center ${
                    n.is_read
                      ? "border-olive/10 bg-[#fbfaf7]"
                      : "border-gold/40 bg-gold/10"
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold text-olive-dark">{n.title}</p>
                    <p className="mt-0.5 text-xs text-ink/65">{n.message}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-ink/45">
                    <span>{new Date(n.created_at).toLocaleDateString("ar")}</span>
                    {n.link && (
                      <Link href={n.link} className="font-bold text-clay hover:underline">
                        عرض ←
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* قسم مساقاتي المفضلة والمواد المحفوظة */}
        {(favoriteCourses.length > 0 || bookmarkedMaterials.length > 0) && (
          <section className="mt-7 grid gap-6 md:grid-cols-2">
            {favoriteCourses.length > 0 && (
              <div className="rounded-[28px] border border-olive/10 bg-white p-6 shadow-card">
                <h2 className="font-display text-xl font-bold text-olive-dark">مساقاتي المفضلة ★</h2>
                <div className="mt-4 space-y-2">
                  {favoriteCourses.map((c) => (
                    <Link
                      key={c.id}
                      href={`/universities/${c.university_id}/${c.id}`}
                      className="flex items-center justify-between rounded-2xl border border-olive/10 bg-[#fbfaf7] p-3.5 text-sm transition hover:border-gold/40"
                    >
                      <div>
                        <p className="font-bold text-olive-dark">{c.name_ar}</p>
                        <p className="text-xs text-ink/50">
                          {c.code ? `${c.code} · ` : ""}
                          {c.university_name}
                        </p>
                      </div>
                      <span className="text-clay">←</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {bookmarkedMaterials.length > 0 && (
              <div className="rounded-[28px] border border-olive/10 bg-white p-6 shadow-card">
                <h2 className="font-display text-xl font-bold text-olive-dark">
                  المواد المحفوظة ★
                </h2>
                <div className="mt-4 space-y-2">
                  {bookmarkedMaterials.map((b) => (
                    <Link
                      key={b.id}
                      href={`/material/${b.id}`}
                      className="flex items-center justify-between rounded-2xl border border-olive/10 bg-[#fbfaf7] p-3.5 text-sm transition hover:border-gold/40"
                    >
                      <span className="font-bold text-olive-dark line-clamp-1">{b.title_ar}</span>
                      <span className="text-clay">←</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* قسم منشوراتي */}
        <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl font-bold text-olive-dark">منشوراتي</h2>
          <p className="mt-1 text-sm text-ink/50">
            يمكنك تعديل العنوان والوصف أو حذف ما نشرته خلال {SELF_EDIT_WINDOW_HOURS} ساعات من نشره.
            أي تعديل على رابط الملف يمر بمراجعة الإدارة قبل ظهوره للعامة.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[700px] text-right">
              <thead>
                <tr className="border-b border-olive/10 text-xs font-black text-ink/40">
                  <th className="p-3">العنوان</th>
                  <th className="p-3">المساق</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">تاريخ النشر</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {myMaterials.map((m) => (
                  <tr key={m.id} className="border-b border-olive/5">
                    <td className="p-3 font-bold">
                      <Link href={`/material/${m.id}`} className="hover:text-clay hover:underline">
                        {m.title_ar}
                      </Link>
                    </td>
                    <td className="p-3 text-sm">{m.course_name || "—"}</td>
                    <td className="p-3 text-xs font-black">{MATERIAL_TYPE_LABELS[m.type]}</td>
                    <td className="p-3 text-xs text-ink/45">
                      {new Date(m.created_at).toLocaleString("ar")}
                    </td>
                    <td className="p-3">
                      {m.editable ? (
                        <>
                          <button
                            onClick={() => setEditing(m)}
                            className="ml-2 rounded-xl border border-olive/10 px-3 py-2 text-xs font-black hover:bg-olive/5"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => del(m.id)}
                            className="rounded-xl border border-clay/15 px-3 py-2 text-xs font-black text-clay-dark hover:bg-clay/5"
                          >
                            حذف
                          </button>
                        </>
                      ) : (
                        <span
                          className="text-xs font-bold text-ink/35"
                          title="انتهت مهلة التعديل، تواصل مع الإدارة"
                        >
                          انتهت المهلة
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!myMaterials.length && (
              <p className="p-10 text-center text-sm text-ink/40">لم تُنشر أي مادة باسمك بعد.</p>
            )}
          </div>
        </section>

        {/* قسم مساهماتي */}
        <section className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card">
          <h2 className="font-display text-2xl font-bold text-olive-dark">مساهماتي</h2>
          <p className="mt-1 text-sm text-ink/50">
            كل مادة أو مساق ترسله يحتاج موافقة المسؤولين قبل ظهوره للعامة.
          </p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[650px] text-right">
              <thead>
                <tr className="border-b border-olive/10 text-xs font-black text-ink/40">
                  <th className="p-3">العنوان</th>
                  <th className="p-3">النوع</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x: any) => (
                  <tr key={x.id} className="border-b border-olive/5">
                    <td className="p-3 font-bold">
                      {x.kind === "course" ? x.suggested_course_name : x.title_ar}
                      <div className="mt-1 text-xs font-normal text-ink/40">
                        {x.kind === "course"
                          ? `اقتراح مساق · ${x.suggested_course_code} · ${
                              x.suggested_universities?.name_ar || ""
                            }`
                          : x.courses?.name_ar || "—"}
                      </div>
                    </td>
                    <td className="p-3 text-sm">
                      {x.kind === "course"
                        ? "مساق جديد"
                        : x.kind === "material_edit"
                        ? "تحديث ملف مادة"
                        : MATERIAL_TYPE_LABELS[x.type as MaterialType] || "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          x.status === "approved"
                            ? "bg-emerald-700/10 text-emerald-900"
                            : x.status === "rejected"
                            ? "bg-clay/10 text-clay-dark"
                            : "bg-olive/7 text-olive-dark"
                        }`}
                      >
                        {STATUS_LABELS[x.status] || x.status}
                      </span>
                      {x.status === "rejected" && x.admin_note && (
                        <p className="mt-1 max-w-xs text-xs leading-5 text-clay-dark">
                          السبب: {x.admin_note}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-xs text-ink/45">
                      {new Date(x.created_at).toLocaleDateString("ar")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && (
              <p className="p-10 text-center text-sm text-ink/40">لم ترسل أي مساهمة بعد.</p>
            )}
          </div>
        </section>
      </div>

      {editing && (
        <EditModal
          material={editing}
          onClose={() => setEditing(null)}
          onSaved={(pendingMsg) => {
            setEditing(null);
            if (pendingMsg) setNoticeBanner(pendingMsg);
            loadAccountData();
          }}
        />
      )}
    </main>
  );
}

function EditModal({
  material,
  onClose,
  onSaved,
}: {
  material: Material & { editable: boolean };
  onClose: () => void;
  onSaved: (pendingMessage?: string) => void;
}) {
  const [title, setTitle] = useState(material.title_ar);
  const [desc, setDesc] = useState(material.description_ar || "");
  const [link, setLink] = useState(material.drive_link || material.youtube_id || "");
  const [year, setYear] = useState(material.academic_year || "");
  const [sem, setSem] = useState(material.semester || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await authFetch("/api/materials/mine", {
      method: "PATCH",
      body: JSON.stringify({
        id: material.id,
        title_ar: title.trim(),
        description_ar: desc.trim(),
        academic_year: year,
        semester: sem,
        drive_link: material.type === "video" ? undefined : link,
        youtube_input: material.type === "video" ? link : undefined,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setErr(d.error || "تعذر الحفظ");
      return;
    }
    onSaved(d.pendingLinkReview ? d.message : undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-olive/35 p-5 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-bold text-olive-dark">تعديل منشور</h3>
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-ink/40">
            ✕
          </button>
        </div>

        <form onSubmit={save} className="mt-5 space-y-3">
          <input
            required
            maxLength={MAX_TITLE_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان المادة"
            className={INPUT_CLASS}
          />
          <textarea
            maxLength={MAX_DESCRIPTION_LENGTH}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="وصف اختياري"
            className={`${INPUT_CLASS} resize-none`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={year} onChange={(e) => setYear(e.target.value)} className={INPUT_CLASS}>
              <option value="">العام الدراسي (اختياري)</option>
              {ACADEMIC_YEAR_OPTIONS.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <select value={sem} onChange={(e) => setSem(e.target.value)} className={INPUT_CLASS}>
              <option value="">الفصل الدراسي (اختياري)</option>
              {Object.entries(SEMESTER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {material.type === "video" ? (
            <input
              required
              dir="ltr"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="رابط YouTube"
              className={INPUT_CLASS}
            />
          ) : (
            <DriveFileInput currentLink={link} onUploaded={(l) => setLink(l)} />
          )}

          <p className="text-[11px] text-ink/50">
            ملاحظة: تعديل العنوان والوصف والفصل يظهر فورًا، بينما يتطلب استبدال رابط الملف موافقة
            المسؤولين أولًا.
          </p>

          <button
            disabled={busy || !link}
            className="w-full rounded-2xl bg-olive py-3 font-black text-parchment disabled:opacity-50"
          >
            {busy ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </button>

          {err && (
            <div className="rounded-2xl bg-clay/5 p-3 text-sm font-bold text-clay-dark">{err}</div>
          )}
        </form>
      </div>
    </div>
  );
}
