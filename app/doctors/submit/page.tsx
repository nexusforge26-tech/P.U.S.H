"use client";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getDoctorById, getFaculties, getUniversities, searchDoctors } from "@/lib/data";
import type { Doctor, Faculty, University } from "@/lib/types";

const input = "w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";

export default function SubmitDoctorPage() {
  return <Suspense fallback={null}><SubmitDoctorForm /></Suspense>;
}

function SubmitDoctorForm() {
  const sp = useSearchParams();
  const preselectedEditId = sp.get("edit") || "";

  const [session, setSession] = useState<any>(null);
  const [mode, setMode] = useState<"new" | "edit">(preselectedEditId ? "edit" : "new");

  const [universities, setUniversities] = useState<University[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);

  const [existingDoctors, setExistingDoctors] = useState<Doctor[]>([]);
  const [targetId, setTargetId] = useState(preselectedEditId);
  const [current, setCurrent] = useState<Doctor | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [office, setOffice] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [courses, setCourses] = useState<string[]>([""]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // تسجيل الدخول مطلوب لأي مساهمة.
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/auth"; return; }
      setSession(session);
    })();
  }, []);

  useEffect(() => { getUniversities().then(setUniversities).catch(() => setUniversities([])); }, []);
  useEffect(() => {
    if (!universityId) { setFaculties([]); return; }
    getFaculties(universityId).then(setFaculties).catch(() => setFaculties([]));
  }, [universityId]);

  // وضع "تعديل دكتور موجود": ابحث عن الدكتور المطلوب من القائمة.
  useEffect(() => {
    if (mode !== "edit") return;
    searchDoctors({}).then(setExistingDoctors).catch(() => setExistingDoctors([]));
  }, [mode]);

  // عند اختيار الدكتور المطلوب تعديله، عبّئ الحقول ببياناته الحالية حتى يظهر
  // الفرق بوضوح بين القديم وما سيُرسله المستخدم.
  useEffect(() => {
    if (mode !== "edit" || !targetId) { setCurrent(null); return; }
    getDoctorById(targetId).then((d) => {
      setCurrent(d);
      if (!d) return;
      setFullName(d.full_name);
      setEmail(d.email);
      setPhone(d.phone || "");
      setOffice(d.office_location || "");
      setUniversityId(d.university_id);
      setFacultyId(d.faculty_id);
      setCourses(d.courses.length ? d.courses : [""]);
    }).catch(() => setCurrent(null));
  }, [mode, targetId]);

  function resetForm() {
    setFullName(""); setEmail(""); setPhone(""); setOffice("");
    setUniversityId(""); setFacultyId(""); setCourses([""]); setTargetId(""); setCurrent(null);
  }

  function switchMode(next: "new" | "edit") {
    setMode(next); setMsg(""); setErr("");
    resetForm();
  }

  function updateCourse(i: number, value: string) {
    setCourses((c) => c.map((x, idx) => (idx === i ? value : x)));
  }
  function addCourse() { setCourses((c) => [...c, ""]); }
  function removeCourse(i: number) { setCourses((c) => (c.length > 1 ? c.filter((_, idx) => idx !== i) : c)); }

  const cleanedCourses = useMemo(() => courses.map((c) => c.trim()).filter(Boolean), [courses]);

  // مقارنة القديم بالمقترح (تظهر فقط في وضع التعديل، قبل الإرسال).
  const diffRows = useMemo(() => {
    if (mode !== "edit" || !current) return [];
    const uniName = universities.find((u) => u.id === universityId)?.name_ar || universityId;
    const facName = faculties.find((f) => f.id === facultyId)?.name_ar || current.faculty_name || "";
    const oldUniName = current.university_name || current.university_id;
    const oldFacName = current.faculty_name || current.faculty_id;
    const rows: { label: string; oldV: string; newV: string }[] = [
      { label: "الاسم الكامل", oldV: current.full_name, newV: fullName },
      { label: "البريد الإلكتروني", oldV: current.email, newV: email },
      { label: "الرقم الخاص", oldV: current.phone || "—", newV: phone || "—" },
      { label: "موقع المكتب", oldV: current.office_location || "—", newV: office || "—" },
      { label: "الجامعة", oldV: oldUniName, newV: uniName },
      { label: "الكلية", oldV: oldFacName, newV: facName },
      { label: "المساقات", oldV: current.courses.join("، ") || "—", newV: cleanedCourses.join("، ") || "—" },
    ];
    return rows.filter((r) => r.oldV !== r.newV);
  }, [mode, current, fullName, email, phone, office, universityId, facultyId, cleanedCourses, universities, faculties]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (mode === "edit" && !targetId) { setErr("اختر الدكتور المطلوب تعديل معلوماته أولًا"); return; }
    setBusy(true); setErr(""); setMsg("");
    const r = await fetch("/api/doctor-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        kind: mode,
        target_doctor_id: mode === "edit" ? targetId : undefined,
        full_name: fullName, email, phone, office_location: office,
        university_id: universityId, faculty_id: facultyId, courses: cleanedCourses,
      }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(d.error || "تعذر الإرسال"); return; }
    setMsg(mode === "edit"
      ? "تم إرسال طلب التعديل بنجاح. سيتم تحديث المعلومات بعد موافقة المسؤول."
      : "تم إرسال معلومات الدكتور بنجاح. ستظهر بعد موافقة المسؤول.");
    resetForm();
  }

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9">
          <p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · DOCTORS</p>
          <h1 className="mt-2 font-display text-4xl font-bold">معلومات دكتور</h1>
          <p className="mt-3 text-sm leading-7 text-parchment/65">
            يمكن لأي شخص إضافة أو تعديل معلومات دكتور، لكن لن تُنشر أو تُحدَّث حتى تتم مراجعتها والموافقة عليها من المسؤول.
          </p>
        </div>

        <div className="mt-6 flex gap-2 rounded-[20px] border border-olive/10 bg-white p-2 shadow-card">
          <button type="button" onClick={() => switchMode("new")} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black ${mode === "new" ? "bg-olive text-parchment" : "text-ink/55 hover:bg-olive/5"}`}>دكتور جديد</button>
          <button type="button" onClick={() => switchMode("edit")} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-black ${mode === "edit" ? "bg-olive text-parchment" : "text-ink/55 hover:bg-olive/5"}`}>تعديل دكتور موجود</button>
        </div>

        <form onSubmit={save} className="mt-5 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card sm:p-8 space-y-3">
          {mode === "edit" && (
            <select required value={targetId} onChange={(e) => setTargetId(e.target.value)} className={input}>
              <option value="">اختر الدكتور المطلوب تعديل معلوماته</option>
              {existingDoctors.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name} — {d.university_name} · {d.faculty_name}</option>
              ))}
            </select>
          )}

          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم الكامل" className={input} />
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className={input} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="الرقم الخاص (اختياري)" className={input} />
          <input value={office} onChange={(e) => setOffice(e.target.value)} placeholder="موقع المكتب" className={input} />

          <div className="grid gap-3 sm:grid-cols-2">
            <select required value={universityId} onChange={(e) => { setUniversityId(e.target.value); setFacultyId(""); }} className={input}>
              <option value="">اختر الجامعة</option>
              {universities.map((u) => <option key={u.id} value={u.id}>{u.name_ar}</option>)}
            </select>
            <select required value={facultyId} disabled={!universityId} onChange={(e) => setFacultyId(e.target.value)} className={input}>
              <option value="">{universityId ? "اختر الكلية" : "اختر الجامعة أولًا"}</option>
              {faculties.map((f) => <option key={f.id} value={f.id}>{f.name_ar}</option>)}
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-ink/50">المساقات التي يدرّسها</p>
            <div className="space-y-2">
              {courses.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input value={c} onChange={(e) => updateCourse(i, e.target.value)} placeholder={`المساق ${i + 1}`} className={input} />
                  {courses.length > 1 && (
                    <button type="button" onClick={() => removeCourse(i)} className="shrink-0 rounded-2xl border border-clay/15 px-4 text-clay-dark">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addCourse} className="mt-2 text-xs font-bold text-clay hover:underline">+ إضافة مساق آخر</button>
          </div>

          {diffRows.length > 0 && (
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
              <p className="text-xs font-black text-olive-dark">الفرق بين المعلومات الحالية والمقترحة</p>
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

          <button disabled={busy} className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment">
            {busy ? "جارٍ الإرسال..." : mode === "edit" ? "إرسال طلب التعديل للمراجعة" : "إرسال للمراجعة"}
          </button>
          {err && <div className="rounded-2xl bg-clay/5 p-4 text-sm font-bold text-clay-dark">{err}</div>}
          {msg && <div className="rounded-2xl bg-olive/5 p-4 text-sm font-bold text-olive-dark">{msg}</div>}
        </form>

        <p className="mt-5 text-center text-sm text-ink/50">
          <Link href="/doctors" className="font-bold text-clay hover:underline">← العودة إلى معلومات الدكاترة</Link>
        </p>
      </div>
    </main>
  );
}
