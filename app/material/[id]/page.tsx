import Link from "next/link";
import { notFound } from "next/navigation";
import YouTubePlayer from "@/components/YouTubePlayer";
import TypeBadge from "@/components/TypeBadge";
import DownloadButton from "@/components/DownloadButton";
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
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/browse" className="text-sm text-ink/50 hover:text-clay">
        ← العودة للتصفح
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TypeBadge type={material.type} />
        {material.university_name && (
          <span className="text-sm text-ink/50">{material.university_name}</span>
        )}
      </div>

      <h1 className="mt-3 font-display text-3xl leading-tight text-olive-dark sm:text-4xl">
        {material.title_ar}
      </h1>

      <p className="mt-2 text-ink/60">
        {material.course_name}
        {material.faculty_name ? ` · ${material.faculty_name}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/50">
        {material.academic_year && <span>العام الدراسي: {material.academic_year}</span>}
        {semesterLabel && <span>{semesterLabel}</span>}
      </div>

      <div className="mt-8">
        {material.type === "video" && material.youtube_id ? (
          <YouTubePlayer youtubeId={material.youtube_id} title={material.title_ar} />
        ) : material.drive_link ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-olive/15 bg-white shadow-card">
              <iframe title={material.title_ar} src={material.drive_link.replace(/\/edit(?:\?.*)?$/i, "/preview").replace(/\/view(?:\?.*)?$/i, "/preview")} className="h-[70vh] min-h-[520px] w-full" allow="autoplay" />
            </div>
            <div className="flex justify-end"><DownloadButton materialId={material.id} driveLink={material.drive_link} /></div>
          </div>
        ) : null}
      </div>

      {material.description_ar && (
        <div className="mt-8 rounded-2xl border border-olive/10 bg-white/40 p-6">
          <h2 className="mb-2 font-display text-lg text-olive-dark">تفاصيل إضافية</h2>
          <p className="leading-relaxed text-ink/75">{material.description_ar}</p>
        </div>
      )}
    </div>
  );
}
