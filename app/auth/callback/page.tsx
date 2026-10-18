"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { sanitizeNextPath } from "@/lib/safeRedirect";
import { isProfileComplete } from "@/lib/profile";

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
    let started = false;
    const begin = (accessToken: string) => {
      if (started) return;
      started = true;
      void finishWithOnboarding(accessToken);
    };

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

    // أول تسجيل: نحوّل المستخدم مباشرة إلى قسم «بياناتي» في صفحة الحساب (مرة واحدة فقط).
    // النافذة المنبثقة تُؤجَّل إلى أول فتح لاحق للموقع إن بقيت البيانات ناقصة.
    const finishWithOnboarding = async (accessToken: string) => {
      try {
        const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${accessToken}` } });
        if (res.ok) {
          const { profile } = await res.json();
          if (profile && !profile.onboarding_redirected_at && !isProfileComplete(profile)) {
            await fetch("/api/profile/prompted", {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ step: "onboarding" }),
            }).catch(() => {});
            try {
              sessionStorage.setItem("push_onboarding_session", "1");
              sessionStorage.removeItem("push_auth_next");
            } catch {
              // تجاهل
            }
            if (!done) {
              done = true;
              router.replace("/account#my-data");
            }
            return;
          }
        }
      } catch {
        // أي فشل: نتابع الوجهة العادية
      }
      finish();
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
      if (session) begin(session.access_token);
    };

    run();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) begin(session.access_token);
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
