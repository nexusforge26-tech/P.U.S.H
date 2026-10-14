"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getCourseById, getCourses, getUniversities } from "@/lib/data";
import { MATERIAL_TYPE_LABELS, SEMESTER_LABELS, type Course, type University } from "@/lib/types";
import DriveFileInput from "@/components/DriveFileInput";

const input = "w-full rounded-2xl border border-olive/10 bg-[#fbfaf7] px-4 py-3 text-sm text-ink outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/10";
export default function SubmitPage() { return <Suspense fallback={null}><SubmitForm /></Suspense>; }

function SubmitForm() {
  const sp = useSearchParams();
  const [session, setSession] = useState<any>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [course, setCourse] = useState(sp.get("course") || "");
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState("");
  const [type, setType] = useState<any>("exam"); const [year, setYear] = useState(""); const [sem, setSem] = useState("");
  const [link, setLink] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/auth"; return; }
      setSession(session);
      setUniversities(await getUniversities().catch(() => []));
      // فتح الصفحة من زر "أضف مادة لهذا المساق": نحدد الجامعة تلقائيًا من المساق.
      const pre = sp.get("course");
      if (pre) {
        const c = await getCourseById(pre).catch(() => null);
        if (c) setUniversityId(c.university_id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!universityId) { setCourses([]); return; }
    getCourses(universityId).then(setCourses).catch(() => setCourses([]));
  }, [universityId]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!session) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ kind: "material", course_id: course, title_ar: title, description_ar: desc, type, academic_year: year, semester: sem, drive_link: type === "video" ? "" : link, youtube_input: type === "video" ? link : "" }),
    });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { setMsg(d.error || "تعذر الإرسال"); return; }
    setMsg("تم إرسال المادة بنجاح. ستظهر بعد موافقة المسؤولين.");
    setTitle(""); setDesc(""); setLink("");
  }

  return <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10"><div className="mx-auto max-w-2xl">
    <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9"><p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · CONTRIBUTION</p><h1 className="mt-2 font-display text-4xl font-bold">إضافة مادة جديدة</h1><p className="mt-3 text-sm leading-7 text-parchment/65">اختر الجامعة ثم المساق وارفع المادة. لن يتم نشرها حتى تتم مراجعتها والموافقة عليها.</p></div>
    <form onSubmit={save} className="mt-7 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card sm:p-8 space-y-3">
      <select required value={universityId} onChange={(e) => { setUniversityId(e.target.value); setCourse(""); }} className={input}>
        <option value="">اختر الجامعة</option>
        {universities.map((u) => <option key={u.id} value={u.id}>{u.name_ar}</option>)}
      </select>
      <select required disabled={!universityId} value={course} onChange={(e) => setCourse(e.target.value)} className={input}>
        <option value="">{universityId ? "اختر المساق" : "اختر الجامعة أولًا"}</option>
        {courses.map((c) => <option key={c.id} value={c.id}>{c.name_ar}{c.code ? ` · ${c.code}` : ""}</option>)}
      </select>
      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان المادة" className={input} />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="وصف اختياري" className={`${input} resize-none`} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className={input}>{Object.entries(MATERIAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={sem} onChange={(e) => setSem(e.target.value)} className={input}><option value="">الفصل</option>{Object.entries(SEMESTER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="العام الدراسي (اختياري)" className={input} />
      {type === "video"
        ? <input required value={link} onChange={(e) => setLink(e.target.value)} placeholder="رابط YouTube" className={input} />
        : <DriveFileInput token={session?.access_token || ""} currentLink={link} onUploaded={(l) => setLink(l)} />}
      <button disabled={busy || !link || !course} className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment disabled:opacity-50">{busy ? "جارٍ الإرسال..." : "إرسال للمراجعة"}</button>
      {msg && <div className="rounded-2xl bg-olive/5 p-4 text-sm font-bold text-olive-dark">{msg}</div>}
    </form>
    <p className="mt-5 text-center text-sm text-ink/50">لم تجد مساقك في القائمة؟ <Link href="/submit/course" className="font-bold text-clay hover:underline">اقترح مساقًا جديدًا</Link></p>
  </div></main>;
}
