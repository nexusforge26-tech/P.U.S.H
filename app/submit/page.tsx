"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getCourseById, getCourses, getUniversities, searchMaterials } from "@/lib/data";
import {
  ACADEMIC_YEAR_OPTIONS,
  MATERIAL_TYPE_LABELS,
  SEMESTER_LABELS,
  type Course,
  type Material,
  type MaterialType,
  type University,
} from "@/lib/types";
import DriveFileInput, { type UploadedFileMetadata } from "@/components/DriveFileInput";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from "@/lib/validation";
import { normalizeArabic } from "@/lib/arabic";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS } from "@/lib/styles";

export default function SubmitPage() {
  return (
    <Suspense fallback={null}>
      <SubmitForm />
    </Suspense>
  );
}

function SubmitForm() {
  const sp = useSearchParams();
  const [ready, setReady] = useState(false);
  const [universities, setUniversities] = useState<University[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseMaterials, setCourseMaterials] = useState<Material[]>([]);

  const [universityId, setUniversityId] = useState("");
  const [course, setCourse] = useState(sp.get("course") || "");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<MaterialType>("exam");
  const [year, setYear] = useState("");
  const [sem, setSem] = useState("");
  const [link, setLink] = useState("");
  const [uploadMeta, setUploadMeta] = useState<UploadedFileMetadata | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const pre = sp.get("course");
      if (!session) {
        const nextUrl = pre ? `/submit?course=${encodeURIComponent(pre)}` : "/submit";
        window.location.href = `/auth?next=${encodeURIComponent(nextUrl)}`;
        return;
      }
      setReady(true);
      setUniversities(await getUniversities().catch(() => []));
      if (pre) {
        const c = await getCourseById(pre).catch(() => null);
        if (c) setUniversityId(c.university_id);
      }
    })();
  }, [sp]);

  useEffect(() => {
    if (!universityId) {
      setCourses([]);
      return;
    }
    getCourses(universityId)
      .then(setCourses)
      .catch(() => setCourses([]));
  }, [universityId]);

  // جلب مواد المساق الحالي للتحذير عند وجود عنوان مشابه مسبقًا
  useEffect(() => {
    if (!course) {
      setCourseMaterials([]);
      return;
    }
    searchMaterials({ courseId: course, pageSize: 50 })
      .then((res) => setCourseMaterials(res.items))
      .catch(() => setCourseMaterials([]));
  }, [course]);

  const similarMaterials = useMemo(() => {
    const normTitle = normalizeArabic(title);
    if (normTitle.length < 5 || courseMaterials.length === 0) return [];
    return courseMaterials.filter((m) => {
      const normExisting = normalizeArabic(m.title_ar);
      return (
        normExisting === normTitle ||
        normExisting.includes(normTitle) ||
        normTitle.includes(normExisting)
      );
    });
  }, [title, courseMaterials]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setErr("");

    const r = await authFetch("/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        kind: "material",
        course_id: course,
        title_ar: title.trim(),
        description_ar: desc.trim(),
        type,
        academic_year: year,
        semester: sem,
        drive_link: type === "video" ? "" : link,
        youtube_input: type === "video" ? link : "",
        file_size: uploadMeta?.fileSize ?? null,
        mime_type: uploadMeta?.mimeType ?? null,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);

    if (!r.ok) {
      setErr(d.error || "تعذر الإرسال");
      return;
    }

    setMsg("تم إرسال المادة بنجاح ✓ ستظهر في المكتبة بعد موافقة المسؤولين، وسيصلك إشعار في حسابك.");
    setTitle("");
    setDesc("");
    setLink("");
    setUploadMeta(null);
  }

  if (!ready) return <main className="min-h-[70vh] bg-[#f7f5ef]" />;

  return (
    <main className="min-h-[70vh] bg-[#f7f5ef] px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-[32px] bg-olive p-7 text-parchment shadow-soft sm:p-9">
          <p className="text-xs font-black tracking-[.2em] text-gold-light">PUSH · CONTRIBUTION</p>
          <h1 className="mt-2 font-display text-4xl font-bold">إضافة مادة جديدة</h1>
          <p className="mt-3 text-sm leading-7 text-parchment/65">
            اختر الجامعة ثم المساق وارفع المادة. لن يتم نشرها حتى تتم مراجعتها والموافقة عليها.
          </p>
        </div>

        <form
          onSubmit={save}
          className="mt-7 space-y-3 rounded-[28px] border border-olive/10 bg-white p-6 shadow-card sm:p-8"
        >
          <select
            required
            value={universityId}
            onChange={(e) => {
              setUniversityId(e.target.value);
              setCourse("");
            }}
            className={INPUT_CLASS}
          >
            <option value="">اختر الجامعة</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name_ar}
              </option>
            ))}
          </select>

          <select
            required
            disabled={!universityId}
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">{universityId ? "اختر المساق" : "اختر الجامعة أولًا"}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_ar}
                {c.code ? ` · ${c.code}` : ""}
              </option>
            ))}
          </select>

          <div>
            <input
              required
              maxLength={MAX_TITLE_LENGTH}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان المادة (مثال: ملخص شامل للفصل الأول - د. أحمد)"
              className={INPUT_CLASS}
            />
            <div className="mt-1 flex justify-between px-1 text-[11px] text-ink/40">
              <span>اكتب عنوانًا واضحًا يصف محتوى الملف بدقة</span>
              <span>
                {title.length}/{MAX_TITLE_LENGTH}
              </span>
            </div>
          </div>

          {similarMaterials.length > 0 && (
            <div className="rounded-2xl border border-gold/40 bg-gold/10 p-3.5 text-xs leading-6 text-olive-dark">
              <p className="font-black">⚠️ تنبيه: توجد مواد بعنوان مشابه في هذا المساق:</p>
              <ul className="mt-1 list-inside list-disc text-ink/75">
                {similarMaterials.slice(0, 3).map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/material/${m.id}`}
                      target="_blank"
                      className="underline hover:text-clay"
                    >
                      {m.title_ar}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-ink/55">
                تأكد أن الملف الذي ترفعه غير مكرر أو أنه يخص فصلًا/عامًا مختلفًا.
              </p>
            </div>
          )}

          <div>
            <textarea
              maxLength={MAX_DESCRIPTION_LENGTH}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="وصف اختياري (المواضيع المشمولة، اسم المدرّس، ملاحظات للطلاب...)"
              className={`${INPUT_CLASS} resize-none`}
            />
            <div className="mt-1 flex justify-end px-1 text-[11px] text-ink/40">
              <span>
                {desc.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as MaterialType)}
              className={INPUT_CLASS}
            >
              {Object.entries(MATERIAL_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            <select value={sem} onChange={(e) => setSem(e.target.value)} className={INPUT_CLASS}>
              <option value="">الفصل الدراسي (اختياري)</option>
              {Object.entries(SEMESTER_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            <select value={year} onChange={(e) => setYear(e.target.value)} className={INPUT_CLASS}>
              <option value="">العام الدراسي (اختياري)</option>
              {ACADEMIC_YEAR_OPTIONS.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {type === "video" ? (
            <input
              required
              dir="ltr"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="رابط YouTube (https://www.youtube.com/watch?v=...)"
              className={INPUT_CLASS}
            />
          ) : (
            <DriveFileInput
              currentLink={link}
              onUploaded={(l, _name, meta) => {
                setLink(l);
                setUploadMeta(meta ?? null);
              }}
            />
          )}

          <button
            disabled={busy || !link || !course}
            className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment disabled:opacity-50"
          >
            {busy ? "جارٍ الإرسال..." : "إرسال للمراجعة"}
          </button>

          {err && (
            <div className="rounded-2xl bg-clay/5 p-4 text-sm font-bold text-clay-dark">{err}</div>
          )}
          {msg && (
            <div className="rounded-2xl bg-olive/5 p-4 text-sm font-bold text-olive-dark">{msg}</div>
          )}
        </form>

        <p className="mt-5 text-center text-sm text-ink/50">
          لم تجد مساقك في القائمة؟{" "}
          <Link href="/submit/course" className="font-bold text-clay hover:underline">
            اقترح مساقًا جديدًا
          </Link>
        </p>
      </div>
    </main>
  );
}
