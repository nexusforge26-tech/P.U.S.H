"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { ACTIVITY_ACTION_LABELS, MATERIAL_TYPE_LABELS, type MaterialType } from "@/lib/types";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";
import { formatBytes } from "@/lib/uploadLimits";
import type { DriveQuotaInfo } from "@/lib/types";

export type AdminTabKey =
  | "overview"
  | "submissions"
  | "doctors"
  | "reports"
  | "content"
  | "members"
  | "log";

interface Overview {
  scoped: boolean;
  totals: { materials: number; courses: number; universities: number; doctors: number; members: number; downloads: number };
  week: { materials: number; members: number };
  attention: { unverifiedMaterials: number; incompleteProfiles: number };
  roles: Record<UserRole, number> | null;
  topMaterials: { id: string; title_ar: string; type: string; downloads: number; course_name: string | null }[];
  recentActivity: {
    id: string;
    actor_name: string | null;
    actor_email: string | null;
    action: string;
    title_ar: string | null;
    created_at: string;
  }[];
}

const n = (v: number) => v.toLocaleString("ar");

export default function OverviewTab({
  pending,
  driveQuota,
  scopeName,
  onNavigate,
}: {
  pending: { submissions: number; doctorSubmissions: number; reports: number; total: number };
  driveQuota: DriveQuotaInfo | null;
  scopeName: string | null;
  onNavigate: (tab: AdminTabKey) => void;
}) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driveCheck, setDriveCheck] = useState<null | {
    mode: string;
    accountEmail: string | null;
    folderName: string | null;
    folderOwnerEmail: string | null;
    inSharedDrive: boolean;
    canWrite: boolean | null;
    publicEditAccess?: boolean | null;
    error: string | null;
  }>(null);
  const [checkingDrive, setCheckingDrive] = useState(false);

  async function runDriveCheck() {
    setCheckingDrive(true);
    try {
      const r = await authFetch("/api/admin/drive-check");
      setDriveCheck(r.ok ? await r.json() : { mode: "?", accountEmail: null, folderName: null, folderOwnerEmail: null, inSharedDrive: false, canWrite: null, error: "تعذر تنفيذ الفحص" });
    } catch {
      setDriveCheck(null);
    }
    setCheckingDrive(false);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await authFetch("/api/admin/overview");
      if (r.ok) setData(await r.json());
      else setError(true);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const queue: { key: AdminTabKey; label: string; hint: string; count: number }[] = [
    { key: "submissions", label: "مساهمات معلقة", hint: "مواد ومساقات مقترحة", count: pending.submissions },
    { key: "doctors", label: "طلبات الدكاترة", hint: "إضافة وتعديل بيانات", count: pending.doctorSubmissions },
    { key: "reports", label: "بلاغات مفتوحة", hint: "روابط معطلة ومخالفات", count: pending.reports },
  ];

  const kpis = data
    ? [
        { label: "المواد", value: data.totals.materials, sub: `+${n(data.week.materials)} هذا الأسبوع` },
        { label: "المساقات", value: data.totals.courses },
        ...(data.scoped ? [] : [{ label: "الجامعات", value: data.totals.universities }]),
        { label: "الدكاترة", value: data.totals.doctors },
        { label: "الأعضاء", value: data.totals.members, sub: `+${n(data.week.members)} هذا الأسبوع` },
        { label: "التنزيلات", value: data.totals.downloads },
      ]
    : [];

  const rolesTotal = data?.roles ? Object.values(data.roles).reduce((a, b) => a + b, 0) || 1 : 1;

  return (
    <div className="space-y-6">
      {/* 1) ما يحتاج إجراءً الآن */}
      <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[.16em] text-clay">TODAY</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-olive-dark">يحتاج إجراءً الآن</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              pending.total > 0 ? "bg-red-50 text-red-700" : "bg-olive/7 text-olive-dark"
            }`}
          >
            {pending.total > 0 ? `${n(pending.total)} طلب معلّق` : "كل شيء مُراجَع ✓"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {queue.map((q) => (
            <button
              key={q.key}
              type="button"
              onClick={() => onNavigate(q.key)}
              className={`rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-card ${
                q.count > 0 ? "border-red-200 bg-red-50/60" : "border-olive/10 bg-[#fbfaf7]"
              }`}
            >
              <p className={`font-display text-3xl font-bold ${q.count > 0 ? "text-red-700" : "text-olive-dark"}`}>
                {n(q.count)}
              </p>
              <p className="mt-1 text-sm font-black text-olive-dark">{q.label}</p>
              <p className="mt-0.5 text-xs text-ink/45">{q.hint}</p>
            </button>
          ))}
        </div>

        {data && (data.attention.unverifiedMaterials > 0 || data.attention.incompleteProfiles > 0) && (
          <ul className="mt-4 space-y-1.5 text-xs font-bold text-ink/60">
            {data.attention.unverifiedMaterials > 0 && (
              <li>• {n(data.attention.unverifiedMaterials)} مادة منشورة غير موثّقة بعد.</li>
            )}
            {data.attention.incompleteProfiles > 0 && (
              <li>• {n(data.attention.incompleteProfiles)} عضو لم يكمل بياناته بعد.</li>
            )}
          </ul>
        )}
      </section>

      {error && (
        <div className="rounded-2xl bg-clay/5 p-4 text-center text-sm font-bold text-clay-dark">
          تعذر تحميل ملخص اللوحة.
          <button type="button" onClick={load} className="mr-2 underline">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* 2) مؤشرات */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-olive-dark">
            {scopeName ? `أرقام ${scopeName}` : "أرقام المنصة"}
          </h2>
          <button type="button" onClick={load} className="text-xs font-black text-ink/45 hover:text-olive-dark">
            {loading ? "جارٍ التحديث..." : "تحديث ↻"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {loading && !data
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border border-olive/10 bg-white" />
              ))
            : kpis.map((k) => (
                <div key={k.label} className="rounded-2xl border border-olive/10 bg-white p-4 shadow-card">
                  <p className="text-xs font-black text-ink/45">{k.label}</p>
                  <p className="mt-1 font-display text-3xl font-bold text-olive-dark">{n(k.value)}</p>
                  {k.sub && <p className="mt-0.5 text-[11px] font-bold text-olive/70">{k.sub}</p>}
                </div>
              ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 3) الأكثر تنزيلًا */}
        <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-display text-xl font-bold text-olive-dark">الأكثر تنزيلًا</h2>
          <div className="mt-4 space-y-2">
            {(data?.topMaterials ?? []).map((m, i) => (
              <Link
                key={m.id}
                href={`/material/${m.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-olive/10 bg-[#fbfaf7] p-3 hover:bg-olive/5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-olive text-sm font-black text-parchment">
                  {n(i + 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-olive-dark">{m.title_ar}</span>
                  <span className="block truncate text-xs text-ink/45">
                    {MATERIAL_TYPE_LABELS[m.type as MaterialType] ?? m.type}
                    {m.course_name ? ` · ${m.course_name}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-black text-clay">{n(m.downloads)} ⬇</span>
              </Link>
            ))}
            {data && data.topMaterials.length === 0 && (
              <p className="rounded-2xl border border-dashed border-olive/15 p-8 text-center text-sm text-ink/40">
                لا توجد بيانات تنزيل بعد.
              </p>
            )}
          </div>
        </section>

        {/* 4) آخر النشاط */}
        <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-olive-dark">آخر النشاط</h2>
            <button
              type="button"
              onClick={() => onNavigate("log")}
              className="text-xs font-black text-clay hover:underline"
            >
              عرض السجل كاملًا
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {(data?.recentActivity ?? []).map((a) => (
              <div key={a.id} className="rounded-2xl border border-olive/10 bg-[#fbfaf7] p-3">
                <p className="text-sm font-bold text-olive-dark">{a.actor_name || a.actor_email || "مستخدم محذوف"}</p>
                <p className="mt-0.5 text-xs text-ink/55">
                  {ACTIVITY_ACTION_LABELS[a.action] || a.action}
                  {a.title_ar ? ` · ${a.title_ar}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-ink/35">{new Date(a.created_at).toLocaleString("ar")}</p>
              </div>
            ))}
            {data && data.recentActivity.length === 0 && (
              <p className="rounded-2xl border border-dashed border-olive/15 p-8 text-center text-sm text-ink/40">
                لا يوجد نشاط مسجّل بعد.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* 5) الأدوار + التخزين (للمسؤول العام فقط) */}
      {data?.roles && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-olive-dark">توزيع الأعضاء</h2>
              <button
                type="button"
                onClick={() => onNavigate("members")}
                className="text-xs font-black text-clay hover:underline"
              >
                إدارة الأعضاء
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {(["owner", "admin", "uni_admin", "user"] as UserRole[]).map((r) => {
                const count = data.roles![r];
                const pct = Math.round((count / rolesTotal) * 100);
                return (
                  <div key={r}>
                    <div className="flex justify-between text-xs font-bold text-ink/60">
                      <span>{ROLE_LABELS[r]}</span>
                      <span>{n(count)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-olive/10">
                      <div className="h-full rounded-full bg-olive" style={{ width: `${Math.max(pct, count ? 3 : 0)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[28px] border border-olive/10 bg-white p-5 shadow-card sm:p-6">
            <h2 className="font-display text-xl font-bold text-olive-dark">التخزين (Google Drive)</h2>
            {driveQuota ? (
              <div className="mt-4">
                <p className="text-sm font-bold text-olive-dark">
                  {formatBytes(driveQuota.usage)}
                  {driveQuota.limit ? ` من ${formatBytes(driveQuota.limit)}` : ""}
                </p>
                {driveQuota.percentUsed !== null && (
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-olive/10">
                    <div
                      className={`h-full rounded-full ${driveQuota.isNearLimit ? "bg-red-500" : "bg-olive"}`}
                      style={{ width: `${Math.min(100, driveQuota.percentUsed)}%` }}
                    />
                  </div>
                )}
                <p className={`mt-2 text-xs font-bold ${driveQuota.isNearLimit ? "text-red-700" : "text-ink/45"}`}>
                  {driveQuota.isNearLimit
                    ? "⚠️ اقتربت المساحة من الحد الأقصى — احذف ملفات غير لازمة أو وسّع المساحة."
                    : "المساحة ضمن الحد الآمن."}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-ink/45">تعذر قراءة حصة التخزين حاليًا.</p>
            )}

            <div className="mt-5 border-t border-olive/10 pt-4">
              <button
                type="button"
                onClick={runDriveCheck}
                disabled={checkingDrive}
                className="rounded-xl bg-olive px-4 py-2 text-xs font-black text-parchment disabled:opacity-50"
              >
                {checkingDrive ? "جارٍ الفحص..." : "فحص إعدادات الرفع إلى Drive"}
              </button>
              {driveCheck && (
                <dl className="mt-3 space-y-1.5 text-xs text-ink/70" dir="rtl">
                  <div>
                    <dt className="inline font-black">طريقة الدخول: </dt>
                    <dd className="inline">
                      {driveCheck.mode === "oauth" ? "حساب Google (OAuth)" : driveCheck.mode === "service_account" ? "حساب خدمة (Service Account)" : driveCheck.mode}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-black">حساب الرفع: </dt>
                    <dd className="inline" dir="ltr">{driveCheck.accountEmail ?? "غير معروف"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-black">المجلد: </dt>
                    <dd className="inline">{driveCheck.folderName ?? "غير ظاهر للحساب"}</dd>
                  </div>
                  {driveCheck.folderOwnerEmail && (
                    <div>
                      <dt className="inline font-black">مالك المجلد: </dt>
                      <dd className="inline" dir="ltr">{driveCheck.folderOwnerEmail}</dd>
                    </div>
                  )}
                  <p
                    className={`rounded-xl p-3 font-black ${
                      driveCheck.canWrite ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {driveCheck.canWrite
                      ? "✓ الحساب يملك صلاحية الكتابة في مجلد الموقع."
                      : `✗ ${driveCheck.error ?? "تعذر التأكد من الصلاحية"}`}
                  </p>
                  <p
                    className={`rounded-xl p-3 font-black ${
                      driveCheck.publicEditAccess ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {driveCheck.publicEditAccess
                      ? "⚠️ خطر: المجلد مفتوح للتعديل لأي شخص معه الرابط. غيّر «الوصول العام» إلى «مقيّد» أو «مشاهد» فورًا."
                      : "✓ لا يوجد وصول عام بالتعديل على المجلد (الزوار يشاهدون الملفات فقط)."}
                  </p>
                  {!driveCheck.canWrite && driveCheck.accountEmail && (
                    <p className="font-bold text-ink/60">
                      الحل: افتح المجلد في Google Drive ← «مشاركة» ← أضف <span dir="ltr">{driveCheck.accountEmail}</span> بصلاحية «محرر» (Editor).
                    </p>
                  )}
                </dl>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
