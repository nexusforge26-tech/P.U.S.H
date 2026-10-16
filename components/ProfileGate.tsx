"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import ProfileForm from "@/components/ProfileForm";
import { getUniversities } from "@/lib/data";
import { isProfileComplete } from "@/lib/profile";
import { authFetch } from "@/lib/authFetch";
import type { University } from "@/lib/types";

// نافذة تظهر **مرة واحدة فقط** لكل حساب لم يُكمل بياناته (يُسجَّل أول عرض في profiles.profile_prompted_at).
// أثناء عرضها تعطّل الصفحة خلفها (inert)، ولا تظهر بعد ذلك عند كل دخول؛ ومن لم يكملها يكملها من «حسابي».
// الحماية الفعلية تبقى في الـ API (rejectIfProfileIncomplete): لا مساهمات ولا رفع قبل اكتمال البيانات.
export default function ProfileGate() {
  const { user, profile, loading, signOut } = useAuth();
  const [universities, setUniversities] = useState<University[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const [dismissed, setDismissed] = useState(false);
  const promptedRef = useRef(false);

  // تظهر فقط إن كانت البيانات ناقصة ولم تُعرض لهذا الحساب من قبل
  const needsProfile =
    !loading && !!user && !!profile && !isProfileComplete(profile) && !profile.profile_prompted_at && !dismissed;

  // نسجّل العرض الأول في السيرفر فورًا (حتى لو أُغلق المتصفح)، فلا تتكرر النافذة لاحقًا
  useEffect(() => {
    if (!needsProfile || promptedRef.current) return;
    promptedRef.current = true;
    authFetch("/api/profile/prompted", { method: "POST" }).catch(() => {});
  }, [needsProfile]);

  useEffect(() => {
    if (!needsProfile) return;
    let cancelled = false;
    setLoadError(false);
    getUniversities()
      .then((list) => {
        if (!cancelled) setUniversities(list);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsProfile, attempt]);

  // استثناء تشغيلي: إن لم تكن هناك أي جامعة مضافة بعد، لا يمكن لأحد إكمال النموذج،
  // فلا نحبس المسؤول/المالك خارج لوحة الإدارة التي يضيف منها الجامعات.
  const isStaff = profile?.role === "admin" || profile?.role === "owner";
  // (مسؤول الجامعة مرتبط بجامعة موجودة أصلًا، فلا يحتاج هذا الاستثناء)
  const noUniversitiesYet = universities !== null && universities.length === 0;
  const blocking = needsProfile && !(isStaff && noUniversitiesYet);

  // تعطيل بقية الصفحة (منع التنقل بالكيبورد وقارئات الشاشة) + منع التمرير خلف النافذة
  useEffect(() => {
    if (!blocking) return;
    const shell = document.getElementById("app-shell");
    shell?.setAttribute("inert", "");
    shell?.setAttribute("aria-hidden", "true");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      shell?.removeAttribute("inert");
      shell?.removeAttribute("aria-hidden");
      document.body.style.overflow = prevOverflow;
    };
  }, [blocking]);

  if (!blocking) return null;

  async function logout() {
    await signOut();
    window.location.href = "/";
  }

  const hasUnis = universities !== null && universities.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-gate-title"
      className="fixed inset-0 z-[100] overflow-y-auto bg-olive-dark/85 px-4 py-8 backdrop-blur-sm"
    >
      <div className="mx-auto w-full max-w-lg rounded-[32px] border border-olive/10 bg-white p-6 shadow-soft sm:p-9">
        <p className="text-xs font-black tracking-[.2em] text-clay">PUSH · إكمال الحساب</p>
        <h2 id="profile-gate-title" className="mt-2 font-display text-3xl font-bold text-olive-dark">
          أكمل بياناتك للمتابعة
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink/60">
          جميع الحقول التالية مطلوبة لإرسال المساهمات ورفع الملفات، ولن تظهر هذه النافذة مرة أخرى (يمكنك الإكمال لاحقًا من صفحة حسابي). ستبقى بياناتك خاصة ولا تظهر للزوار،
          ويطّلع عليها مسؤولو المنصة فقط.
        </p>

        <div className="mt-6">
          {hasUnis && (
            <ProfileForm
              universities={universities as University[]}
              initial={profile}
              submitLabel="حفظ ومتابعة"
            />
          )}

          {universities === null && !loadError && (
            <p className="rounded-2xl bg-olive/5 p-4 text-center text-sm font-bold text-olive-dark">
              جارٍ تحميل قائمة الجامعات...
            </p>
          )}

          {loadError && (
            <div className="rounded-2xl bg-clay/5 p-4 text-center text-sm font-bold text-clay-dark">
              تعذر تحميل قائمة الجامعات.
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="mr-2 underline"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {noUniversitiesYet && !isStaff && (
            <p className="rounded-2xl bg-gold/10 p-4 text-center text-sm font-bold text-olive-dark">
              لم تُضف أي جامعة بعد. يرجى المحاولة لاحقًا بعد أن يضيف المسؤولون الجامعات.
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex-1 rounded-2xl border border-olive/10 px-5 py-3 text-sm font-bold text-ink/60 hover:bg-olive/5"
          >
            لاحقًا (من صفحة حسابي)
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex-1 rounded-2xl border border-olive/10 px-5 py-3 text-sm font-bold text-ink/60 hover:bg-olive/5"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}
