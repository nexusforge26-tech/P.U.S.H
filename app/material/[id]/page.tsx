import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import YouTubePlayer from "@/components/YouTubePlayer";
import TypeBadge from "@/components/TypeBadge";
import DownloadButton from "@/components/DownloadButton";
import DocViewer from "@/components/DocViewer";
import MaterialActions from "@/components/MaterialActions";
import MaterialAdminBar from "@/components/MaterialAdminBar";
import { getMaterialById } from "@/lib/data";
import { MATERIAL_TYPE_LABELS, SEMESTER_LABELS } from "@/lib/types";
import { formatBytes, formatMimeLabel } from "@/lib/uploadLimits";
import { youtubeThumb } from "@/lib/youtube";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const material = await getMaterialById(params.id).catch(() => null);
  if (!material) {
    return { title: "مادة غير موجودة" };
  }

  const typeLabel = MATERIAL_TYPE_LABELS[material.type] || "مادة دراسية";
  const coursePart = material.course_name ? ` — ${material.course_name}` : "";
  const uniPart = material.university_name ? ` (${material.university_name})` : "";
  const title = `${material.title_ar}${coursePart}`;
  const description =
    material.description_ar ||
    `${typeLabel} لمساق ${material.course_name || ""}${uniPart} على منصة PUSH الطلابية.`;

  const images =
    material.type === "video" && material.youtube_id
      ? [{ url: youtubeThumb(material.youtube_id), width: 480, height: 360, alt: material.title_ar }]
      : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

export default async function MaterialPage({ params }: { params: { id: string } }) {
  let material;
  try {
    material = await getMaterialById(params.id);
  } catch {
    material = null;
  }

  if (!material) notFound();

  const semesterLabel = material.semester ? SEMESTER_LABELS[material.semester] : null;
  const mimeLabel =
    material.type !== "video" ? formatMimeLabel(material.mime_type, material.drive_link) : null;
  const sizeLabel =
    material.type !== "video" && material.file_size && material.file_size > 0
      ? formatBytes(material.file_size)
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 rounded-full border border-olive/10 bg-white/70 px-4 py-2 text-xs font-bold text-olive-dark shadow-sm transition hover:bg-white hover:text-clay"
          >
            <span>←</span> العودة إلى المكتبة
          </Link>
          {material.university_id && (
            <Link
              href={`/universities/${material.university_id}/${material.course_id}`}
              className="inline-flex items-center gap-1 rounded-full border border-olive/10 bg-white/70 px-4 py-2 text-xs font-bold text-ink/70 shadow-sm transition hover:bg-white hover:text-olive-dark"
            >
              صفحة المساق: {material.course_name}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <TypeBadge type={material.type} />
        {material.is_verified && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/20 bg-emerald-700/10 px-3 py-1 text-xs font-bold text-emerald-900">
            <span>✓</span>
            <span>موثّق من الإدارة</span>
          </span>
        )}
        {material.university_name && (
          <span className="rounded-lg bg-olive/5 px-2.5 py-1 text-xs font-medium text-ink/70">
            {material.university_name}
          </span>
        )}
        {mimeLabel && (
          <span className="rounded-lg bg-gold/15 px-2.5 py-1 text-xs font-bold text-olive-dark">
            {mimeLabel}
          </span>
        )}
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-olive-dark sm:text-4xl lg:text-[2.6rem]">
        {material.title_ar}
      </h1>

      <p className="mt-2 text-base font-medium text-ink/65">
        المساق:{" "}
        <span className="font-bold text-olive-dark">
          {material.course_name}
          {material.course_code ? ` (${material.course_code})` : ""}
        </span>
      </p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-ink/50">
        {material.academic_year && <span>العام الدراسي: {material.academic_year}</span>}
        {semesterLabel && <span>الفصل: {semesterLabel}</span>}
        {sizeLabel && <span>حجم الملف: {sizeLabel}</span>}
        {material.page_count && material.page_count > 0 && (
          <span>عدد الصفحات: {material.page_count}</span>
        )}
        <span>المشاهدات والتحميلات: {material.downloads_count}</span>
      </div>

      <div className="mt-5">
        <MaterialActions
          materialId={material.id}
          materialTitle={material.title_ar}
          initialHelpfulCount={material.helpful_count ?? 0}
        />
      </div>

      <MaterialAdminBar
        material={{
          id: material.id,
          course_id: material.course_id,
          title_ar: material.title_ar,
          description_ar: material.description_ar,
          type: material.type,
          academic_year: material.academic_year,
          semester: material.semester,
          drive_link: material.drive_link,
          youtube_id: material.youtube_id,
          is_featured: material.is_featured,
          is_verified: material.is_verified,
          file_size: material.file_size,
          mime_type: material.mime_type,
          university_id: material.university_id,
        }}
      />

      <div className="mt-8">
        {material.type === "video" && material.youtube_id ? (
          <YouTubePlayer youtubeId={material.youtube_id} title={material.title_ar} />
        ) : material.drive_link ? (
          <div className="space-y-4">
            <DocViewer material={material} />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-ink/50">
                يمكنك أيضًا تنزيل الملف وحفظه للرجوع إليه دون إنترنت:
              </span>
              <DownloadButton materialId={material.id} driveLink={material.drive_link} />
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-olive/10 bg-white p-12 text-center shadow-card">
            <span className="text-4xl">📎</span>
            <h3 className="mt-3 font-display text-lg font-bold text-olive-dark">
              لا يوجد رابط مباشر متاح لهذا الملف
            </h3>
          </div>
        )}
      </div>

      {material.description_ar && (
        <div className="mt-10 rounded-3xl border border-olive/10 bg-white/60 p-6 shadow-card sm:p-8">
          <h2 className="mb-3 font-display text-xl font-bold text-olive-dark">
            تفاصيل وملاحظات إضافية
          </h2>
          <p className="text-sm leading-relaxed text-ink/80 sm:text-base">
            {material.description_ar}
          </p>
        </div>
      )}
    </div>
  );
}
