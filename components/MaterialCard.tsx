import Link from "next/link";
import Image from "next/image";
import type { Material } from "@/lib/types";
import TypeBadge from "@/components/TypeBadge";
import TypeIcon from "@/components/TypeIcon";
import { youtubeThumb } from "@/lib/youtube";
import { formatBytes, formatMimeLabel } from "@/lib/uploadLimits";

export default function MaterialCard({ material }: { material: Material }) {
  const video = material.type === "video";
  const mimeLabel = !video ? formatMimeLabel(material.mime_type, material.drive_link) : null;
  const sizeLabel =
    !video && material.file_size && material.file_size > 0
      ? formatBytes(material.file_size)
      : null;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[26px] border border-olive/10 bg-white shadow-card transition duration-300 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-soft">
      <Link href={`/material/${material.id}`} className="flex flex-1 flex-col">
        {/* صورة مصغرة أو رمز النوع */}
        <div className="relative aspect-video-box overflow-hidden bg-olive-dark">
          {video && material.youtube_id ? (
            <>
              <Image
                src={youtubeThumb(material.youtube_id)}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 340px"
                className="object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-parchment text-clay shadow-xl transition group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-olive-dark bg-tatreez">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-parchment ring-1 ring-white/15">
                <TypeIcon type={material.type} className="h-7 w-7" />
              </span>
              {(mimeLabel || sizeLabel) && (
                <span className="rounded-full bg-black/25 px-3 py-0.5 text-[11px] font-bold text-parchment/85">
                  {[mimeLabel, sizeLabel].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          )}

          {material.is_verified && (
            <span
              title="مادة موثّقة ومراجَعة من الإدارة"
              className="absolute left-3 top-3 rounded-full bg-emerald-700/90 px-2.5 py-1 text-[10px] font-black text-parchment shadow-sm backdrop-blur-sm"
            >
              موثّق ✓
            </span>
          )}
        </div>

        {/* تفاصيل البطاقة */}
        <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <TypeBadge type={material.type} />
            {material.semester && (
              <span className="text-[11px] font-medium text-ink/40">
                {material.semester === "first"
                  ? "فصل 1"
                  : material.semester === "second"
                  ? "فصل 2"
                  : "صيفي"}
              </span>
            )}
          </div>

          <h3 className="line-clamp-2 font-display text-[19px] font-bold leading-snug text-ink transition-colors group-hover:text-olive">
            {material.title_ar}
          </h3>

          <p className="line-clamp-1 text-sm text-ink/55">
            {material.course_name}
            {material.university_name ? ` · ${material.university_name}` : ""}
          </p>

          <div className="mt-auto flex items-center justify-between border-t border-ink/5 pt-3 text-[11px] text-ink/45">
            <span>{material.academic_year ?? "—"}</span>
            <div className="flex items-center gap-3">
              {typeof material.helpful_count === "number" && material.helpful_count > 0 && (
                <span className="font-bold text-olive-dark">👍 {material.helpful_count}</span>
              )}
              <span>{material.downloads_count} مشاهدة/تحميل</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
