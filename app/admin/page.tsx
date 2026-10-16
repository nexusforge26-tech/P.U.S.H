"use client";

import { useCallback, useEffect, useState } from "react";
import AuthGate, { logoutAdmin } from "./AuthGate";
import UniversityDirectoryTab from "./components/UniversityDirectoryTab";
import SubmissionsTab from "./components/SubmissionsTab";
import DoctorSubmissionsTab from "./components/DoctorSubmissionsTab";
import MembersTab from "./components/MembersTab";
import ActivityLogTab from "./components/ActivityLogTab";
import ReportsTab from "./components/ReportsTab";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/components/AuthProvider";
import { roleLabel } from "@/lib/roles";
import { formatBytes } from "@/lib/uploadLimits";
import type { DriveQuotaInfo } from "@/lib/types";

type AdminTabKey = "content" | "submissions" | "doctors" | "reports" | "members" | "log";

export default function AdminHome() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}

function Dashboard() {
  const { profile, managedUniversityName } = useAuth();
  const isScoped = profile?.role === "uni_admin";
  const [tab, setTab] = useState<AdminTabKey>("content");
  const [pending, setPending] = useState({
    total: 0,
    submissions: 0,
    doctorSubmissions: 0,
    reports: 0,
  });
  const [driveQuota, setDriveQuota] = useState<DriveQuotaInfo | null>(null);

  const loadPendingCounts = useCallback(async (withQuota = false) => {
    const r = await authFetch(`/api/admin/pending-count${withQuota ? "?quota=1" : ""}`);
    if (r.ok) {
      const data = await r.json();
      setPending({
        total: data.total ?? 0,
        submissions: data.submissions ?? 0,
        doctorSubmissions: data.doctorSubmissions ?? 0,
        reports: data.reports ?? 0,
      });
      if (data.driveQuota) {
        setDriveQuota(data.driveQuota);
      }
    }
  }, []);

  useEffect(() => {
    loadPendingCounts(true);
    // يستخدم authFetch الذي يجلب أحدث توكن من الجلسة عند كل استدعاء فلا يتجمد العداد بعد ساعة
    const t = setInterval(() => loadPendingCounts(false), 30000);
    return () => clearInterval(t);
  }, [loadPendingCounts]);

  const TABS: readonly [AdminTabKey, string, number?][] = [
    ["content", "المحتوى"],
    ["submissions", "المساهمات المعلقة", pending.submissions],
    ["doctors", "معلومات الدكاترة", pending.doctorSubmissions],
    ["reports", "البلاغات", pending.reports],
    ["members", "الأعضاء والصلاحيات"],
    ["log", "سجل المنشورات"],
  ];

  return (
    <main className="admin-shell min-h-screen">
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:py-10">
        <header className="rounded-[32px] bg-olive p-6 text-parchment shadow-soft sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-black tracking-[.2em] text-gold-light">
                <span>PUSH · ADMIN</span>
                {profile && (
                  <span className="rounded-full bg-white/10 px-3 py-1.5 tracking-normal text-parchment ring-1 ring-white/15">
                    {roleLabel(profile.role, managedUniversityName)}
                  </span>
                )}
                {pending.total > 0 && (
                  <button
                    onClick={() => setTab("submissions")}
                    className="flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 tracking-normal text-white ring-1 ring-red-300/25"
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-70" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    {pending.total.toLocaleString("ar")} طلب معلّق
                  </button>
                )}
              </div>
              <h1 className="mt-2 font-display text-4xl font-bold">لوحة الإدارة</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-parchment/65">
                {isScoped
                  ? `إدارة محتوى وأعضاء وطلبات ${managedUniversityName ?? "جامعتك"} فقط.`
                  : "إدارة المحتوى، مراجعة مساهمات الأعضاء، متابعة البلاغات، والتحكم في صلاحيات الحسابات."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {driveQuota && (
                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs ring-1 ${
                    driveQuota.isNearLimit
                      ? "bg-red-500/20 text-white ring-red-300/40"
                      : "bg-white/10 text-parchment/85 ring-white/10"
                  }`}
                >
                  <p className="font-black">
                    مساحة Drive: {formatBytes(driveQuota.usage)}
                    {driveQuota.limit ? ` / ${formatBytes(driveQuota.limit)}` : ""}
                    {driveQuota.percentUsed !== null ? ` (${driveQuota.percentUsed}%)` : ""}
                  </p>
                  {driveQuota.isNearLimit && (
                    <p className="mt-0.5 text-[11px] font-bold text-gold-light">
                      ⚠️ اقتربت المساحة من الحد الأقصى!
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={logoutAdmin}
                className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black ring-1 ring-white/10 hover:bg-white/15"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-2 rounded-[24px] border border-olive/10 bg-white p-2 shadow-card">
          {TABS.map(([k, label, badge]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`relative rounded-2xl px-4 py-3 text-sm font-black transition ${
                tab === k ? "bg-olive text-parchment" : "text-ink/55 hover:bg-olive/5"
              }`}
            >
              {label}
              {badge !== undefined && badge > 0 && (
                <span className="mr-2 inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-black leading-5 text-white shadow-sm">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "content" && <UniversityDirectoryTab />}
        {tab === "submissions" && (
          <SubmissionsTab onReviewed={() => loadPendingCounts(false)} />
        )}
        {tab === "doctors" && (
          <DoctorSubmissionsTab onReviewed={() => loadPendingCounts(false)} />
        )}
        {tab === "reports" && <ReportsTab onResolved={() => loadPendingCounts(false)} />}
        {tab === "members" && <MembersTab />}
        {tab === "log" && <ActivityLogTab />}
      </div>
    </main>
  );
}
