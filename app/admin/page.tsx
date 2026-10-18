"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AuthGate, { logoutAdmin } from "./AuthGate";
import UniversityDirectoryTab from "./components/UniversityDirectoryTab";
import SubmissionsTab from "./components/SubmissionsTab";
import DoctorSubmissionsTab from "./components/DoctorSubmissionsTab";
import MembersTab from "./components/MembersTab";
import ActivityLogTab from "./components/ActivityLogTab";
import ReportsTab from "./components/ReportsTab";
import OverviewTab, { type AdminTabKey } from "./components/OverviewTab";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/components/AuthProvider";
import { roleLabel } from "@/lib/roles";
import { formatBytes } from "@/lib/uploadLimits";
import type { DriveQuotaInfo } from "@/lib/types";

interface NavItem {
  key: AdminTabKey;
  label: string;
  icon: string;
  desc: string;
  badge?: number;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const VALID_TABS: AdminTabKey[] = ["overview", "submissions", "doctors", "reports", "content", "members", "log"];

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
  const [tab, setTabState] = useState<AdminTabKey>("overview");

  // الصفحة المفتوحة تُحفظ في الرابط (#submissions...) فلا تضيع عند التحديث ويمكن مشاركتها
  const setTab = useCallback((next: AdminTabKey) => {
    setTabState(next);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      // تجاهل
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "") as AdminTabKey;
    if (VALID_TABS.includes(fromHash)) setTabState(fromHash);
  }, []);
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

  const groups: NavGroup[] = [
    {
      title: "الرئيسية",
      items: [{ key: "overview", label: "نظرة عامة", icon: "▦", desc: "ملخص الأرقام وما يحتاج إجراءً الآن." }],
    },
    {
      title: "المراجعة والطلبات",
      items: [
        {
          key: "submissions",
          label: "المساهمات المعلقة",
          icon: "✎",
          desc: "مراجعة المواد والمساقات التي اقترحها الأعضاء ثم قبولها أو رفضها.",
          badge: pending.submissions,
        },
        {
          key: "doctors",
          label: "معلومات الدكاترة",
          icon: "☺",
          desc: "طلبات إضافة دكاترة وتعديل بياناتهم.",
          badge: pending.doctorSubmissions,
        },
        {
          key: "reports",
          label: "البلاغات",
          icon: "⚑",
          desc: "بلاغات الروابط المعطلة والملفات المخالفة على المواد المنشورة.",
          badge: pending.reports,
        },
      ],
    },
    {
      title: "إدارة المحتوى",
      items: [
        {
          key: "content",
          label: "الجامعات والمساقات",
          icon: "▤",
          desc: isScoped
            ? "إدارة مساقات جامعتك والمواد المنشورة فيها."
            : "إضافة الجامعات والمساقات وإدارة المواد المنشورة.",
        },
      ],
    },
    {
      title: "المجتمع",
      items: [
        {
          key: "members",
          label: "الأعضاء والصلاحيات",
          icon: "☷",
          desc: isScoped ? "أعضاء جامعتك وبياناتهم." : "بحث الأعضاء، تغيير الصلاحيات، وحذف الحسابات.",
        },
      ],
    },
    {
      title: "الرقابة",
      items: [
        {
          key: "log",
          label: "سجل النشاط",
          icon: "☰",
          desc: "من أضاف أو نشر أو راجع ماذا ومتى (للتدقيق والمتابعة).",
        },
      ],
    },
  ];

  const current = groups.flatMap((g) => g.items).find((i) => i.key === tab) ?? groups[0]!.items[0]!;
  const groupBadge = (g: NavGroup) => g.items.reduce((sum, i) => sum + (i.badge ?? 0), 0);

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
                {driveQuota?.isNearLimit && (
                  <button
                    onClick={() => setTab("overview")}
                    className="rounded-full bg-red-500/20 px-3 py-1.5 tracking-normal text-white ring-1 ring-red-300/40"
                  >
                    ⚠️ مساحة Drive شبه ممتلئة
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
              <Link
                href="/"
                className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black ring-1 ring-white/10 hover:bg-white/15"
              >
                عرض الموقع ↗
              </Link>
              <button
                onClick={logoutAdmin}
                className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-black ring-1 ring-white/10 hover:bg-white/15"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* التنقل: قائمة جانبية مجمّعة على الشاشات الكبيرة، وقائمة منسدلة على الجوال */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value as AdminTabKey)}
              className="w-full rounded-2xl border border-olive/10 bg-white px-4 py-3 text-sm font-black text-olive-dark shadow-card lg:hidden"
              aria-label="قسم لوحة الإدارة"
            >
              {groups.map((g) => (
                <optgroup key={g.title} label={g.title}>
                  {g.items.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.label}
                      {i.badge ? ` (${i.badge})` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <nav
              aria-label="أقسام لوحة الإدارة"
              className="hidden rounded-[24px] border border-olive/10 bg-white p-3 shadow-card lg:block"
            >
              {groups.map((g, gi) => (
                <div key={g.title} className={gi > 0 ? "mt-3 border-t border-olive/10 pt-3" : ""}>
                  <p className="flex items-center justify-between px-3 pb-1.5 text-[11px] font-black tracking-[.14em] text-ink/35">
                    <span>{g.title}</span>
                    {groupBadge(g) > 0 && (
                      <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] leading-4 text-white">
                        {groupBadge(g) > 99 ? "99+" : groupBadge(g)}
                      </span>
                    )}
                  </p>
                  {g.items.map((i) => (
                    <button
                      key={i.key}
                      onClick={() => setTab(i.key)}
                      aria-current={tab === i.key ? "page" : undefined}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-right text-sm font-black transition ${
                        tab === i.key ? "bg-olive text-parchment" : "text-ink/60 hover:bg-olive/5"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base ${
                          tab === i.key ? "bg-white/15" : "bg-olive/7"
                        }`}
                        aria-hidden
                      >
                        {i.icon}
                      </span>
                      <span className="flex-1">{i.label}</span>
                      {i.badge !== undefined && i.badge > 0 && (
                        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-black leading-5 text-white shadow-sm">
                          {i.badge > 99 ? "99+" : i.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">
            <div className="mb-1 px-1">
              <p className="text-xs font-black tracking-[.16em] text-clay">
                {groups.find((g) => g.items.some((i) => i.key === tab))?.title}
              </p>
              <h2 className="mt-1 font-display text-3xl font-bold text-olive-dark">{current.label}</h2>
              <p className="mt-1 text-sm text-ink/50">{current.desc}</p>
            </div>

            <div className="[&>section:first-child]:mt-5">
              {tab === "overview" && (
                <div className="mt-5">
                  <OverviewTab
                    pending={pending}
                    driveQuota={driveQuota}
                    scopeName={isScoped ? managedUniversityName ?? "جامعتك" : null}
                    onNavigate={setTab}
                  />
                </div>
              )}
              {tab === "content" && <UniversityDirectoryTab />}
              {tab === "submissions" && <SubmissionsTab onReviewed={() => loadPendingCounts(false)} />}
              {tab === "doctors" && <DoctorSubmissionsTab onReviewed={() => loadPendingCounts(false)} />}
              {tab === "reports" && <ReportsTab onResolved={() => loadPendingCounts(false)} />}
              {tab === "members" && <MembersTab />}
              {tab === "log" && <ActivityLogTab />}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
