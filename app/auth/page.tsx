"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{ if(data.session) router.replace("/") }); },[router]);

  async function google() {
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
    if (error) { setError(error.message); setBusy(false); }
  }

  return <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-16">
    <div className="mx-auto max-w-md rounded-[32px] border border-olive/10 bg-white p-7 text-center shadow-soft sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-olive text-2xl font-black text-parchment">P</div>
      <p className="mt-6 text-xs font-black tracking-[.2em] text-clay">PUSH · الحساب</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-olive-dark">أنشئ حسابك أو سجّل الدخول</h1>
      <p className="mt-3 text-sm leading-7 text-ink/55">المحتوى والتحميل متاحان للجميع. الحساب مطلوب فقط لإرسال المواد والمساهمات.</p>
      <button onClick={google} disabled={busy} className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl border border-olive/10 bg-white px-5 py-3.5 font-black text-ink shadow-card transition hover:-translate-y-0.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#4285F4] text-sm font-black text-white">G</span>
        {busy ? "جارٍ التحويل..." : "المتابعة مع Google"}
      </button>
      {error && <p className="mt-4 rounded-2xl bg-clay/5 p-3 text-sm font-bold text-clay-dark">{error}</p>}
      <p className="mt-6 text-xs leading-6 text-ink/40">باستخدام الحساب، توافق على أن المواد التي ترسلها ستبقى معلّقة حتى مراجعة المسؤولين.</p>
    </div>
  </main>
}
