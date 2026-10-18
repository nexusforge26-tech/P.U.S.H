import Link from "next/link";
import { MATERIAL_TYPE_LABELS } from "@/lib/types";

const SOCIAL_LINKS = [
  {
    name: "إنستغرام",
    href: "https://www.instagram.com/push.edu.ps",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "فيسبوك",
    href: "https://www.facebook.com/share/1JPa2s7XQ1/",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z" />
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer className="mt-10 bg-olive-dark text-parchment/80">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div dir="ltr" className="font-display text-2xl font-bold tracking-[.16em] text-parchment">
              PUSH
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-parchment/60">
              مبادرة طلابية تطوعية تجمع المعرفة الجامعية الفلسطينية في مكان واحد، لتكون المعلومة أقرب
              والطريق أوضح.
            </p>
            <div className="mt-5">
              <p className="text-xs font-bold text-parchment/50">تابعنا على</p>
              <ul className="mt-3 flex items-center gap-3">
                {SOCIAL_LINKS.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`PUSH على ${s.name}`}
                      title={s.name}
                      className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-parchment/80 ring-1 ring-white/10 transition hover:bg-white/20 hover:text-parchment"
                    >
                      {s.icon}
                      <span>{s.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="font-bold text-parchment">تصفّح</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-parchment/60">
              <li>
                <Link href="/browse" className="hover:text-parchment">
                  كل المكتبة
                </Link>
              </li>
              {Object.entries(MATERIAL_TYPE_LABELS).map(([k, l]) => (
                <li key={k}>
                  <Link href={`/browse?type=${k}`} className="hover:text-parchment">
                    {l}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/doctors" className="hover:text-parchment">
                  دليل الدكاترة
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-bold text-parchment">عن PUSH</p>
            <p className="mt-4 text-sm leading-7 text-parchment/60">
              المحتوى يساهم به طلاب وخريجون، ونرحّب بأي إضافة أو تصحيح يساعد المجتمع الطلابي.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-parchment/60">
              <li>
                <Link href="/terms" className="hover:text-parchment underline underline-offset-4">
                  شروط الاستخدام والخصوصية وحقوق النشر
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-parchment/40 sm:flex-row sm:items-center sm:justify-between">
          <span>Palestine University Students Hub — عمل تطوعي غير ربحي</span>
          <span>© {new Date().getFullYear()} PUSH</span>
        </div>

        <div className="mt-5 text-center text-sm text-parchment/50">
          تصميم وتطوير{" "}
          <a
            href="https://ahmad-eideh-portfolio.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="font-black text-blue-400 transition hover:text-blue-300"
          >
            أحمد كامل عيده
          </a>{" "}
          <span className="mx-1 text-parchment/25">·</span> برعاية{" "}
          <span className="font-bold text-parchment/70">مجتمع PPU.PDF</span>
        </div>
      </div>
    </footer>
  );
}
