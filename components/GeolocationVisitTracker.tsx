"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { authFetch } from "@/lib/authFetch";

type TrackerState = "hidden" | "prompt" | "denied" | "unsupported" | "busy" | "done" | "error";

export default function GeolocationVisitTracker() {
  const { user, profile, session, loading } = useAuth();
  const memberId = user?.id ?? null;
  const [state, setState] = useState<TrackerState>("hidden");
  const currentUserId = useRef<string | null>(null);
  const sessionRef = useRef(session);
  const automaticAttemptRef = useRef("");

  useEffect(() => {
    currentUserId.current = user?.id ?? null;
    sessionRef.current = session;
  }, [user?.id, session]);

  const startCheck = useCallback((expectedUserId: string) => {
    if (currentUserId.current !== expectedUserId) return;
    if (!navigator.geolocation) {
      setState("unsupported");
      return;
    }

    setState("busy");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (currentUserId.current !== expectedUserId) return;
        const activeSession = sessionRef.current;
        if (!activeSession || activeSession.user.id !== expectedUserId) return;

        try {
          const response = await authFetch("/api/location/check", {
            method: "POST",
            cache: "no-store",
            headers: { Authorization: `Bearer ${activeSession.access_token}` },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy_m: position.coords.accuracy,
            }),
          });
          if (currentUserId.current !== expectedUserId) return;
          setState(response.ok ? "done" : "error");
          if (response.ok) window.setTimeout(() => setState("hidden"), 1800);
        } catch {
          if (currentUserId.current === expectedUserId) setState("error");
        }
      },
      (error) => {
        if (currentUserId.current !== expectedUserId) return;
        setState(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
    );
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!memberId || profile?.role !== "user") {
      currentUserId.current = null;
      const previousKey = automaticAttemptRef.current.replace(/:started$/, "");
      try {
        if (previousKey) window.sessionStorage.removeItem(previousKey);
      } catch {
        // sessionStorage may be unavailable in hardened browser modes.
      }
      automaticAttemptRef.current = "";
      setState("hidden");
      return;
    }

    const userId = memberId;
    let cancelled = false;
    const visitKey = `push-location-check:${userId}:${Math.floor(performance.timeOrigin)}`;
    if (
      automaticAttemptRef.current === visitKey ||
      automaticAttemptRef.current === `${visitKey}:started`
    ) return;
    automaticAttemptRef.current = visitKey;

    const checkPermission = async () => {
      if (!navigator.geolocation) {
        if (!cancelled) setState("unsupported");
        return;
      }

      let permissionState: PermissionState = "prompt";
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        permissionState = permission.state;
      } catch {
        // بعض المتصفحات لا تدعم فحص حالة الإذن؛ نعرض زرًا يتطلب نقرة واضحة.
      }
      if (cancelled || currentUserId.current !== userId) return;

      if (permissionState === "granted") {
        let alreadyAttempted = false;
        try {
          alreadyAttempted = window.sessionStorage.getItem(visitKey) === "started";
          if (!alreadyAttempted) window.sessionStorage.setItem(visitKey, "started");
        } catch {
          alreadyAttempted = automaticAttemptRef.current === `${visitKey}:started`;
          automaticAttemptRef.current = `${visitKey}:started`;
        }
        if (!alreadyAttempted) startCheck(userId);
      } else if (permissionState === "denied") {
        setState("denied");
      } else {
        setState("prompt");
      }
    };

    void checkPermission();
    return () => {
      cancelled = true;
    };
  }, [loading, memberId, profile?.role, startCheck]);

  if (state === "hidden") return null;

  const copy: Record<Exclude<TrackerState, "hidden">, string> = {
    prompt: "فعّل التحقق الجغرافي · Enable location check",
    denied: "إذن الموقع غير مفعّل. يمكنك تغييره من إعدادات المتصفح.",
    unsupported: "المتصفح لا يدعم تحديد الموقع.",
    busy: "جارٍ تحديث التحقق الجغرافي…",
    done: "تم تحديث التحقق الجغرافي.",
    error: "تعذر تحديث الموقع الآن. حاول مرة أخرى.",
  };

  return (
    <aside
      role="status"
      aria-live="polite"
      dir="rtl"
      className="fixed bottom-4 left-4 z-[100] flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-olive/10 bg-white p-4 text-sm font-bold text-olive-dark shadow-xl"
    >
      <span className="min-w-0 flex-1">{copy[state]}</span>
      {state === "prompt" && user && (
        <button
          type="button"
          onClick={() => startCheck(user.id)}
          className="shrink-0 rounded-xl bg-olive px-3 py-2 text-xs font-black text-white hover:bg-olive-dark"
        >
          تفعيل · Enable
        </button>
      )}
      {state === "error" && user && (
        <button
          type="button"
          onClick={() => startCheck(user.id)}
          className="shrink-0 rounded-xl bg-olive px-3 py-2 text-xs font-black text-white hover:bg-olive-dark"
        >
          إعادة · Retry
        </button>
      )}
      <Link href="/terms#privacy-policy" className="shrink-0 text-xs text-clay-dark underline">
        سياسة الخصوصية · Privacy
      </Link>
      <button
        type="button"
        aria-label="إغلاق · Close"
        onClick={() => setState("hidden")}
        className="shrink-0 rounded-full px-1 text-lg leading-none text-ink/40 hover:text-ink"
      >
        ×
      </button>
    </aside>
  );
}
