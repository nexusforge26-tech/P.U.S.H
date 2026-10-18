"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/safeRedirect";

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-[70vh] place-items-center bg-[#f7f5ef]">
          <div className="rounded-2xl bg-white px-6 py-5 text-sm font-bold text-olive-dark shadow-card">
            جارٍ إكمال تسجيل الدخول...
          </div>
        </main>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let done = false;

    const resolveDestination = () => {
      const fromQuery = sp.get("next");
      if (fromQuery) return sanitizeNextPath(fromQuery);
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem("push_auth_next");
        sessionStorage.removeItem("push_auth_next");
        if (stored) return sanitizeNextPath(stored);
      }
      return "/";
    };

    const finish = () => {
      if (done) return;
      done = true;
      router.replace(resolveDestination());
    };

    const run = async () => {
      const code = sp.get("code");
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          // قد يكون تم تبادل الكود تلقائيًا عبر detectSessionInUrl
        }
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) finish();
    };

    run();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    return () => subscription.unsubscribe();
  }, [router, sp]);

  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#f7f5ef]">
      <div className="rounded-2xl bg-white px-6 py-5 text-sm font-bold text-olive-dark shadow-card">
        جارٍ إكمال تسجيل الدخول...
      </div>
    </main>
  );
}
