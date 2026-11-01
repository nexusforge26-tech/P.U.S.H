"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { authFetch } from "@/lib/authFetch";

// يسجّل زيارة واحدة لكل جلسة متصفح في اليوم (بتوقيت فلسطين)، لمسجّلي الدخول والزوار معًا.
export default function SiteVisitTracker() {
  const { loading } = useAuth();

  useEffect(() => {
    if (loading) return; // ننتظر معرفة حالة الدخول ليُحتسب العضو عضوًا
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/admin")) return; // لا نحتسب تصفّح لوحة الإدارة
    if (navigator.webdriver) return;

    let key = "push-visit";
    try {
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hebron" });
      key = `push-visit:${day}`;
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage غير متاح: نسجّل مرة لكل تحميل بدل تجاهل الزيارة
    }

    authFetch("/api/visits", { method: "POST", keepalive: true }).catch(() => {});
  }, [loading]);

  return null;
}
