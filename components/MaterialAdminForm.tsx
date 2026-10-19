"use client";

import { useState } from "react";
import DriveFileInput, { type UploadedFileMetadata } from "@/components/DriveFileInput";
import { authFetch } from "@/lib/authFetch";
import { INPUT_CLASS } from "@/lib/styles";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from "@/lib/validation";
import { ACADEMIC_YEAR_OPTIONS, MATERIAL_TYPE_LABELS, SEMESTER_LABELS, type Material, type MaterialType } from "@/lib/types";

export interface CourseOption {
  id: string;
  label: string;
}

/**
 * نموذج إضافة/تعديل مادة للمسؤولين (يُستعمل في لوحة الإدارة وفي صفحة المادة نفسها).
 * التحقق الفعلي من الصلاحيات والنطاق يتم في /api/admin/materials.
 */
export default function MaterialAdminForm({
  courseId,
  onSaved,
  existing,
  courseOptions,
}: {
  courseId: string;
  onSaved: () => void;
  existing?: Pick<
    Material,
    | "id"
    | "title_ar"
    | "description_ar"
    | "type"
    | "academic_year"
    | "semester"
    | "drive_link"
    | "youtube_id"
    | "is_featured"
    | "is_verified"
    | "file_size"
    | "mime_type"
  >;
  /** عند تمريرها يظهر اختيار المساق (لنقل المادة إلى مساق آخر). */
  courseOptions?: CourseOption[];
}) {
  const [selectedCourse, setSelectedCourse] = useState(courseId);
  const [title, setTitle] = useState(existing?.title_ar || "");
  const [desc, setDesc] = useState(existing?.description_ar || "");
  const [type, setType] = useState<MaterialType>(existing?.type || "exam");
  const [year, setYear] = useState(existing?.academic_year || "");
  const [sem, setSem] = useState(existing?.semester || "");
  const [link, setLink] = useState(existing?.drive_link || existing?.youtube_id || "");
  const [uploadMeta, setUploadMeta] = useState<UploadedFileMetadata | null>(null);
  const [featured, setFeatured] = useState(existing?.is_featured || false);
  const [verified, setVerified] = useState(existing?.is_verified ?? true);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await authFetch("/api/admin/materials", {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify({
        id: existing?.id,
        course_id: selectedCourse,
        title_ar: title.trim(),
        description_ar: desc.trim(),
        type,
        academic_year: year,
        semester: sem,
        drive_link: type === "video" ? "" : link,
        youtube_input: type === "video" ? link : "",
        is_featured: featured,
        is_verified: verified,
        file_size: uploadMeta?.fileSize ?? existing?.file_size ?? null,
        mime_type: uploadMeta?.mimeType ?? existing?.mime_type ?? null,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      alert(d.error || "تعذر الحفظ");
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      {courseOptions && courseOptions.length > 0 && (
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className={INPUT_CLASS}
          aria-label="المساق"
        >
          {courseOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      )}
      <input
        required
        maxLength={MAX_TITLE_LENGTH}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="عنوان المادة"
        className={INPUT_CLASS}
      />
      <textarea
        maxLength={MAX_DESCRIPTION_LENGTH}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={3}
        placeholder="وصف اختياري"
        className={`${INPUT_CLASS} resize-none`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <select value={type} onChange={(e) => setType(e.target.value as MaterialType)} className={INPUT_CLASS}>
          {Object.entries(MATERIAL_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select value={sem} onChange={(e) => setSem(e.target.value)} className={INPUT_CLASS}>
          <option value="">الفصل الدراسي</option>
          {Object.entries(SEMESTER_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <select value={year} onChange={(e) => setYear(e.target.value)} className={INPUT_CLASS}>
        <option value="">العام الدراسي (اختياري)</option>
        {ACADEMIC_YEAR_OPTIONS.map((yr) => (
          <option key={yr} value={yr}>
            {yr}
          </option>
        ))}
      </select>
      {type === "video" ? (
        <input
          required
          dir="ltr"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="رابط YouTube"
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
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2.5 rounded-2xl border border-olive/10 p-3">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          <span className="text-xs font-bold">مادة مميزة (الصفحة الرئيسية)</span>
        </label>
        <label className="flex items-center gap-2.5 rounded-2xl border border-olive/10 p-3">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          <span className="text-xs font-bold">موثّق من الإدارة ✓</span>
        </label>
      </div>
      <button
        disabled={busy || !link}
        className="w-full rounded-2xl bg-clay py-3.5 font-black text-parchment disabled:opacity-50"
      >
        {busy ? "جارٍ الحفظ..." : existing ? "حفظ التعديلات" : "إضافة المنشور"}
      </button>
    </form>
  );
}
