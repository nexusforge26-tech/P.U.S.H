"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getCourses, getDoctorById, getUniversities, searchDoctors } from "@/lib/data";
import type { Course, Doctor, University } from "@/lib/types";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS } from "@/lib/styles";
import { normalizeArabic } from "@/lib/arabic";

export default function SubmitDoctorPage() {
  return (
    <Suspense fallback={null}>
      <SubmitDoctorForm />
    </Suspense>
  );
}

function SubmitDoctorForm() {
  const sp = useSearchParams();
  const preselectedEditId = sp.get("edit") || "";

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"new" | "edit">(preselectedEditId ? "edit" : "new");

  const [universities, setUniversities] = useState<University[]>([]);
  const [universityCourses, setUniversityCourses] = useState<Course[]>([]);
  const [existingDoctors, setExistingDoctors] = useState<Doctor[]>([]);

  const [targetId, setTargetId] = useState(preselectedEditId);
  const [current, setCurrent] = useState<Doctor | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [office, setOffice] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [courses, setCourses] = useState<string[]>([""]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const nextUrl = preselectedEditId
          ? `/doctors/submit?edit=${encodeURIComponent(preselectedEditId)}`
          : "/doctors/submit";
        window.location.href = `/auth?next=${encodeURIComponent(nextUrl)}`;
        return;
      }
      setReady(true);
    })();
  }, [preselectedEditId]);

  useEffect(() => {
    getUniversities()
      .then(setUniversities)
      .catch(() => setUniversities([]));
    searchDoctors({})
      .then(setExistingDoctors)
      .catch(() => setExistingDoctors([]));
  }, []);

  useEffect(() => {
    if (!universityId) {
      setUniversityCourses([]);
      return;
    }
    getCourses(universityId)
      .then(setUniversityCourses)
      .catch(() => setUniversityCourses([]));
  }, [universityId]);

  useEffect(() => {
    if (mode !== "edit" || !targetId) {
      setCurrent(null);
      return;
    }
    getDoctorById(targetId)
      .then((d) => {
        setCurrent(d);
        if (!d) return;
        setFullName(d.full_name);
        setEmail(d.email);
        setOffice(d.office_location || "");
        setUniversityId(d.university_id);
        setCourses(d.courses.length ? d.courses : [""]);
      })
      .catch(() => setCurrent(null));
  }, [mode, targetId]);

  // كشف فوري للتكرار أثناء كتابة البريد أو الاسم في وضع "دكتور جديد"
  const duplicateDoctor = useMemo(() => {
    if (mode !== "new") return null;
    const cleanEmail = email.trim().toLowerCase();
    const normName = normalizeArabic(fullName);
    return (
      existingDoctors.find(
        (d) =>
          (cleanEmail.length >= 5 && d.email.toLowerCase() === cleanEmail) ||
          (normName.length >= 6 && normalizeArabic(d.full_name) === normName)
      ) ?? null
    );
  }, [mode, email, fullName, existingDoctors]);

  function resetForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setOffice("");
    setUniversityId("");
    setCourses([""]);
    setTargetId("");
    setCurrent(null);
  }

  function switchMode(next: "new" | "edit", editDoctorId?: string) {
    setMode(next);
    setMsg("");
    setErr("");
    if (next === "edit" && editDoctorId) {
      setTargetId(editDoctorId);
    } else {
      resetForm();
    }
  }

  function updateCourse(i: number, value: string) {
    setCourses((c) => c.map((x, idx) => (idx === i ? value : x)));
  }
  function addCourse() {
    setCourses((c) => [...c, ""]);
  }
  function removeCourse(i: number) {
    setCourses((c) => (c.length > 1 ? c.filter((_, idx) => idx !== i) : c));
  }

  const cleanedCourses = useMemo(
    () => courses.map((c) => c.trim()).filter(Boolean),
    [courses]
  );

  const diffRows = useMemo(() => {
    if (mode !== "edit" || !current) return [];
    const uniName = universities.find((u) => u.id === universityId)?.name_ar || universityId;
    const oldUniName = current.university_name || current.university_id;
    const rows: { label: string; oldV: string; newV: string }[] = [
      { label: "الاسم الكامل", oldV: current.full_name, newV: fullName },
      { label: "البريد الإلكتروني", oldV: current.email, newV: email },
      { label: "موقع المكتب", oldV: current.office_location || "—", newV: office || "—" },
      { label: "الجامعة", oldV: oldUniName, newV: uniName },
      {
        label: "المساقات",
        oldV: current.courses.join("، ") || "—",
        newV: cleanedCourses.join("، ") || "—",
      },
    ];
    return rows.filter((r) => r.oldV !== r.newV);
  }, [mode, current, fullName, email, office, universityId, cleanedCourses, universities]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "edit" && !targetId) {
      setErr("اختر الدكتور المطلوب تعديل معلوماته أولًا");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");

    const r = await authFetch("/api/doctor-submissions", {
      method: "POST",
      body: JSON.stringify({
        kind: mode,
        target_doctor_id: mode === "edit" ? targetId : undefined,
        full_name: fullName,
        email,
        office_location: office,
        university_id: universityId,
        courses: cleanedCourses,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);

    if (!r.ok) {
      setErr(d.error || "تعذر الإرسال");
      return;
    }

    setMsg(
      mode === "edit"
        ? "تم إرسال طلب التعديل بنجاح ✓ سيتم تحديث المعلومات بعد موافقة المسؤول."
        : "تم إرسال معلومات الدكتور بنجاح ✓ ستظهر بعد موافقة المسؤول."
    );
    resetForm();
  }

  if (!ready) return <main className="min-h-[70vh] bg-[#f7f5ef]" />;

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9">
          <p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · DOCTORS</p>
          <h1 className="mt-2 font-display text-4xl font-bold">معلومات دكتور</h1>
          <p className="mt-3 text-sm leading-7 text-parchment/65">
            يمكن لأي طالب إضافة أو تعديل معلومات دكتور، وستُنشر بعد مراجعتها والموافقة عليها من
            الإدارة.
          </p>
        </div>

        <div className="mt-6 flex gap-2 rounded-[20px] border border-olive/10 bg-white p-2 shadow-card">
          <button
            type="button"
            onClick={() => switchMode("new")}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black ${
              mode === "new" ? "bg-olive text-parchment" : "text-ink/55 hover:bg-olive/5"
            }`}
          >
            دكتور جديد
          </button>
          <button
            type="button"
            onClick={() => switchMode("edit")}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black ${
              mode === "edit" ? "bg-olive text-parchment" : "text-ink/55 hover:bg-olive/5"
            }`}
          >
            تعديل دكتور موجود
          </button>
        </div>

        <form
          onSubmit={save}
          className="mt-5 space-y-3 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card sm:p-8"
        >
          {mode === "edit" && (
            <select
              required
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">اختر الدكتور المطلوب تعديل معلوماته</option>
              {existingDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} — {d.university_name}
                </option>
              ))}
            </select>
          )}

          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="الاسم الكامل (مثال: د. رضوان طهبوب)"
            className={INPUT_CLASS}
          />

          <input
            required
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني الجامعي"
            className={INPUT_CLASS}
          />

          {duplicateDoctor && (
            <div className="rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-xs leading-6 text-olive-dark">
              <p className="font-black">
                ⚠️ تنبيه: الدكتور «{duplicateDoctor.full_name}» ({duplicateDoctor.email}) موجود
                بالفعل في الدليل.
              </p>
              <button
                type="button"
                onClick={() => switchMode("edit", duplicateDoctor.id)}
                className="mt-1.5 font-black text-clay underline"
              >
                انتقل لتعديل بيانات هذا الدكتور بدلًا من إضافته من جديد ←
              </button>
            </div>
          )}

          <input
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            placeholder="موقع المكتب"
            className={INPUT_CLASS}
          />

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

          <div>
            <p className="mb-2 text-xs font-bold text-ink/50">
              المساقات التي يدرّسها (يمكنك الاختيار من مساقات الجامعة أو كتابة اسم المساق)
            </p>
            <datalist id="uni-courses-list">
              {universityCourses.map((uc) => (
                <option key={uc.id} value={uc.name_ar}>
                  {uc.code ? `${uc.name_ar} (${uc.code})` : uc.name_ar}
                </option>
              ))}
            </datalist>
            <div className="space-y-2">
              {courses.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    list="uni-courses-list"
                    value={c}
                    onChange={(e) => updateCourse(i, e.target.value)}
                    placeholder={`المساق ${i + 1}`}
                    className={INPUT_CLASS}
                  />
                  {courses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCourse(i)}
                      className="shrink-0 rounded-2xl border border-clay/15 px-4 text-clay-dark"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCourse}
              className="mt-2 text-xs font-bold text-clay hover:underline"
            >
              + إضافة مساق آخر
            </button>
          </div>

          {diffRows.length > 0 && (
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
              <p className="text-xs font-black text-olive-dark">
                الفرق بين المعلومات الحالية والمقترحة
              </p>
              <div className="mt-3 space-y-2">
                {diffRows.map((r) => (
                  <div key={r.label} className="text-xs leading-6">
                    <span className="font-bold text-ink/60">{r.label}: </span>
                    <span className="text-clay-dark line-through">{r.oldV}</span>
                    <span className="mx-1 text-ink/30">←</span>
                    <span className="font-bold text-olive-dark">{r.newV}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            disabled={busy}
            className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment disabled:opacity-50"
          >
            {busy
              ? "جارٍ الإرسال..."
              : mode === "edit"
              ? "إرسال طلب التعديل للمراجعة"
              : "إرسال للمراجعة"}
          </button>

          {err && (
            <div className="rounded-2xl bg-clay/5 p-4 text-sm font-bold text-clay-dark">{err}</div>
          )}
          {msg && (
            <div className="rounded-2xl bg-olive/5 p-4 text-sm font-bold text-olive-dark">{msg}</div>
          )}
        </form>

        <p className="mt-5 text-center text-sm text-ink/50">
          <Link href="/doctors" className="font-bold text-clay hover:underline">
            ← العودة إلى معلومات الدكاترة
          </Link>
        </p>
      </div>
    </main>
  );
}
