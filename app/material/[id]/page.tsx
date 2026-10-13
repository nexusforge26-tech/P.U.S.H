import Link from "next/link";
import { notFound } from "next/navigation";
import YouTubePlayer from "@/components/YouTubePlayer";
import TypeBadge from "@/components/TypeBadge";
import DownloadButton from "@/components/DownloadButton";
import BookmarkButton from "@/components/BookmarkButton";
import DocViewer from "@/components/DocViewer";
import { getMaterialById } from "@/lib/data";
import { SEMESTER_LABELS } from "@/lib/types";

export const revalidate = 30;

export default async function MaterialPage({ params }: { params: { id: string } }) {
  let material;
  try {
    material = await getMaterialById(params.id);
  } catch {
    material = null;
  }

  if (!material) notFound();

  const semesterLabel = material.semester ? SEMESTER_LABELS[material.semester] : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 rounded-full border border-olive/10 bg-white/70 px-4 py-2 text-xs font-bold text-olive-dark shadow-sm transition hover:bg-white hover:text-clay"
        >
          <span>←</span> العودة إلى المكتبة
        </Link>
        <div className="flex items-center gap-2">
          <BookmarkButton material={material} variant="full" />
        </div>
      </div>

      {/* Meta tags and Title */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <TypeBadge type={material.type} />
        {material.university_name && (
          <span className="rounded-lg bg-olive/5 px-2.5 py-1 text-xs font-medium text-ink/70">
            {material.university_name}
          </span>
        )}
        {material.faculty_name && (
          <span className="text-xs text-ink/50">· {material.faculty_name}</span>
        )}
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-olive-dark sm:text-4xl lg:text-[2.6rem]">
        {material.title_ar}
      </h1>

      <p className="mt-2 text-base font-medium text-ink/65">
        المساق: <span className="text-olive-dark font-bold">{material.course_name}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-ink/50">
        {material.academic_year && <span>العام الدراسي: {material.academic_year}</span>}
        {semesterLabel && <span>الفصل: {semesterLabel}</span>}
        <span>المشاهدات والتحميلات: {material.downloads_count}</span>
      </div>

      {/* Document Viewer / Video Player */}
      <div className="mt-8">
        {material.type === "video" && material.youtube_id ? (
          <YouTubePlayer youtubeId={material.youtube_id} title={material.title_ar} />
        ) : material.drive_link ? (
          <div className="space-y-4">
            <DocViewer material={material} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-ink/50">
                يمكنك أيضاً تنزيل الملف وحفظه للرجوع إليه دون إنترنت:
              </span>
              <DownloadButton materialId={material.id} driveLink={material.drive_link} />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
            <span className="text-4xl">📎</span>
            <h3 className="mt-3 font-display text-lg font-bold text-olive-dark">لا يوجد رابط مباشر متاح لهذا الملف</h3>
          </div>
        )}
      </div>

      {material.description_ar && (
        <div className="mt-10 rounded-3xl border border-olive/10 bg-white/60 p-6 sm:p-8 shadow-card">
          <h2 className="mb-3 font-display text-xl font-bold text-olive-dark">
            تفاصيل وملاحظات إضافية
          </h2>
          <p className="leading-relaxed text-ink/80 text-sm sm:text-base">
            {material.description_ar}
          </p>
        </div>
      )}
    </div>
  );
}
