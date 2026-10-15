"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

function sanitizeNextPath(raw: string | null): string {
  if (!raw) return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  return trimmed;
}

export default function AuthPage() {
  return (
    <Suspense fallback={<main className="min-h-[70vh] bg-[#f7f5ef]" />}>
      <AuthForm />
    </Suspense>
  );
}

function AuthForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = sanitizeNextPath(sp.get("next"));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextPath);
    });
  }, [router, nextPath]);

  async function google() {
    setBusy(true);
    setError("");
    try {
      if (typeof window !== "undefined" && nextPath !== "/") {
        sessionStorage.setItem("push_auth_next", nextPath);
      }
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (nextPath !== "/") {
        callbackUrl.searchParams.set("next", nextPath);
      }
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callbackUrl.toString() },
      });
      if (oauthErr) {
        setError(oauthErr.message);
        setBusy(false);
      }
    } catch {
      setError("تعذر بدء تسجيل الدخول عبر Google");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-16">
      <div className="mx-auto max-w-md rounded-[32px] border border-olive/10 bg-white p-7 text-center shadow-soft sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-olive text-2xl font-black text-parchment">
          P
        </div>
        <p className="mt-6 text-xs font-black tracking-[.2em] text-clay">PUSH · الحساب</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-olive-dark">
          أنشئ حسابك أو سجّل الدخول
        </h1>
        <p className="mt-3 text-sm leading-7 text-ink/55">
          المحتوى والتحميل متاحان للجميع. الحساب مطلوب فقط لإرسال المواد والمساهمات ومتابعة حالتها.
        </p>

        <button
          onClick={google}
          disabled={busy}
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl border border-olive/10 bg-white px-5 py-3.5 font-black text-ink shadow-card transition hover:-translate-y-0.5"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#4285F4] text-sm font-black text-white">
            G
          </span>
          {busy ? "جارٍ التحويل..." : "المتابعة مع Google"}
        </button>

        {error && (
          <p className="mt-4 rounded-2xl bg-clay/5 p-3 text-sm font-bold text-clay-dark">{error}</p>
        )}

        <p className="mt-6 text-xs leading-6 text-ink/45">
          باستخدام الحساب، فإنك توافق على{" "}
          <Link href="/terms" className="font-bold text-clay hover:underline">
            شروط الاستخدام وسياسة الخصوصية وحقوق النشر
          </Link>
          ، وعلى أن المواد التي ترسلها ستبقى معلّقة حتى مراجعة المسؤولين.
        </p>
      </div>
    </main>
  );
}
