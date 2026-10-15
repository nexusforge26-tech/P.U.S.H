"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getUniversities } from "@/lib/data";
import type { University } from "@/lib/types";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS } from "@/lib/styles";

export default function SuggestCoursePage() {
  const [ready, setReady] = useState(false);
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = `/auth?next=${encodeURIComponent("/submit/course")}`;
        return;
      }
      setReady(true);
      setUniversities(await getUniversities().catch(() => []));
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!code.trim()) {
      setErr("رقم/رمز المساق إجباري");
      return;
    }
    if (!universityId) {
      setErr("اختر الجامعة أولًا");
      return;
    }

    setBusy(true);
    const r = await authFetch("/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        kind: "course",
        suggested_course_name: name.trim(),
        suggested_course_code: code.trim(),
        suggested_university_id: universityId,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);

    if (!r.ok) {
      setErr(d.error || "تعذر الإرسال");
      return;
    }
    setMsg("تم إرسال اقتراح المساق بنجاح ✓ سيظهر بعد موافقة المسؤولين.");
    setName("");
    setCode("");
  }

  if (!ready) return <main className="min-h-[70vh] bg-[#f7f5ef]" />;

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9">
          <p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · CONTRIBUTION</p>
          <h1 className="mt-2 font-display text-4xl font-bold">اقتراح مساق جديد</h1>
          <p className="mt-3 text-sm leading-7 text-parchment/65">
            اقترح مساقًا غير موجود في القائمة. لن يظهر المساق للعامة حتى يوافق عليه المسؤولون.
          </p>
        </div>

        <form
          onSubmit={save}
          className="mt-7 space-y-3 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card sm:p-8"
        >
          <select
            required
            value={universityId}
            onChange={(e) => setUniversityId(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">اختر الجامعة</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name_ar}
              </option>
            ))}
          </select>

          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المساق (مثال: هياكل البيانات والخوارزميات)"
            className={INPUT_CLASS}
          />

          <input
            required
            maxLength={30}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="رقم/رمز المساق (إجباري، مثال: CS201)"
            className={INPUT_CLASS}
          />

          <button
            disabled={busy}
            className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment disabled:opacity-50"
          >
            {busy ? "جارٍ الإرسال..." : "إرسال الاقتراح للمراجعة"}
          </button>

          {err && (
            <div className="rounded-2xl bg-clay/5 p-4 text-sm font-bold text-clay-dark">{err}</div>
          )}
          {msg && (
            <div className="rounded-2xl bg-olive/5 p-4 text-sm font-bold text-olive-dark">{msg}</div>
          )}
        </form>

        <p className="mt-5 text-center text-sm text-ink/50">
          تريد إضافة محتوى لمساق موجود؟{" "}
          <Link href="/submit" className="font-bold text-clay hover:underline">
            أضف مادة
          </Link>
        </p>
      </div>
    </main>
  );
}
