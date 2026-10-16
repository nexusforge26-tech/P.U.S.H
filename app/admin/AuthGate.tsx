"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { authFetch } from "@/lib/authFetch";
import { isStaffRole } from "@/lib/roles";

const KEY = "push_admin_access_token";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setHasSession(false);
          setReady(true);
        }
        return;
      }

      setHasSession(true);
      // نستدعي مسار /api/me الخفيف للتحقق من الدور بدل جلب كل الأعضاء، ولا نقوم بتسجيل خروج المستخدم العادي!
      const r = await authFetch("/api/me");
      if (cancelled) return;

      if (r.ok) {
        const data = await r.json();
        const role = data?.profile?.role;
        // مسؤول الجامعة يدخل اللوحة أيضًا، لكن السيرفر يقيّد بياناته بجامعته
        const scoped = role === "uni_admin" && !data?.profile?.managed_university_id;
        if (isStaffRole(role) && !scoped) {
          sessionStorage.setItem(KEY, session.access_token);
          setAuthed(true);
        } else {
          setError(
            scoped
              ? "حسابك مسؤول جامعة لكنه غير مرتبط بجامعة. تواصل مع المالك لتحديد جامعتك."
              : "هذا الحساب لا يملك صلاحيات الإدارة."
          );
        }
      } else {
        setError("تعذر التحقق من صلاحيات الحساب.");
      }
      setReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        sessionStorage.removeItem(KEY);
        setAuthed(false);
        setHasSession(false);
        return;
      }
      sessionStorage.setItem(KEY, session.access_token);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!ready) return null;
  if (authed) return <>{children}</>;

  return (
    <main className="admin-shell min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
        <div className="w-full rounded-[30px] border border-olive/10 bg-white p-7 text-center shadow-soft sm:p-9">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-olive text-2xl font-black text-parchment">
            P
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-clay">
            PUSH · الإدارة
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-olive-dark">دخول الإدارة</h1>
          <p className="mt-2 text-sm leading-7 text-ink/50">
            استخدم حساب Google المصرّح له بصلاحية مسؤول جامعة أو مسؤول أو مالك.
          </p>

          {error && (
            <p className="mt-4 rounded-2xl bg-clay/5 p-3 text-sm font-bold text-clay-dark">
              {error}
            </p>
          )}

          {hasSession ? (
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href="/"
                className="block w-full rounded-2xl bg-olive px-4 py-3.5 font-black text-parchment hover:bg-olive-dark"
              >
                العودة إلى الصفحة الرئيسية
              </Link>
              <Link
                href="/account"
                className="block w-full rounded-2xl border border-olive/15 px-4 py-3 text-sm font-bold text-olive-dark hover:bg-olive/5"
              >
                الذهاب إلى حسابي
              </Link>
            </div>
          ) : (
            <Link
              href="/auth?next=%2Fadmin"
              className="mt-6 block w-full rounded-2xl bg-olive px-4 py-3.5 font-black text-parchment hover:bg-olive-dark"
            >
              تسجيل الدخول مع Google
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

export function adminToken() {
  return typeof window === "undefined" ? "" : sessionStorage.getItem(KEY) || "";
}

export async function logoutAdmin() {
  sessionStorage.removeItem(KEY);
  await supabase.auth.signOut();
  window.location.href = "/admin";
}
