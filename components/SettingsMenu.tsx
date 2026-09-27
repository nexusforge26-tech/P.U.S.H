"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile(u: any) {
      if (!u) { if (!cancelled) setProfile(null); return; }
      const { data: p } = await supabase.from("profiles").select("full_name,email,role").eq("id", u.id).maybeSingle();
      if (!cancelled) setProfile(p);
    }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); loadProfile(data.user); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setUser(s?.user ?? null); loadProfile(s?.user ?? null); });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function logout() { await supabase.auth.signOut(); window.location.href = "/"; }

  if (!user) return null;
  const isStaff = profile?.role === "admin" || profile?.role === "owner";
  const roleLabel = profile?.role === "owner" ? "المالك" : profile?.role === "admin" ? "مسؤول" : "مستخدم عادي";

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="الإعدادات والحساب"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-olive/15 bg-white/60 text-olive-dark transition hover:bg-white"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-72 rounded-3xl border border-olive/10 bg-white p-4 shadow-soft">
          <div className="rounded-2xl bg-olive/5 p-3">
            <p className="truncate text-sm font-black text-olive-dark">{profile?.full_name || "بدون اسم"}</p>
            <p className="mt-0.5 truncate text-xs text-ink/50">{profile?.email || user.email}</p>
            <span className="mt-2 inline-block rounded-full bg-olive/10 px-2.5 py-1 text-[11px] font-black text-olive-dark">{roleLabel}</span>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <Link href="/account" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-ink/70 hover:bg-olive/5">حسابي ومساهماتي</Link>
            <Link href="/submit" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-ink/70 hover:bg-olive/5">+ إضافة مادة لمساق</Link>
            <Link href="/submit/course" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-ink/70 hover:bg-olive/5">+ اقتراح مساق جديد</Link>
            <Link href="/doctors/submit" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-bold text-ink/70 hover:bg-olive/5">+ إضافة معلومات دكتور</Link>
            {isStaff && <Link href="/admin" onClick={() => setOpen(false)} className="rounded-xl bg-clay/10 px-3 py-2.5 text-sm font-black text-clay-dark hover:bg-clay/20">لوحة الإدارة</Link>}
          </div>
          <button onClick={logout} className="mt-3 w-full rounded-xl bg-clay px-3 py-2.5 text-sm font-black text-parchment hover:bg-clay-dark">تسجيل الخروج</button>
        </div>
      )}
    </div>
  );
}
