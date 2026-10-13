import Link from "next/link";
import Image from "next/image";
import type { Material } from "@/lib/types";
import TypeBadge from "@/components/TypeBadge";
import TypeIcon from "@/components/TypeIcon";
import BookmarkButton from "@/components/BookmarkButton";

function youtubeThumb(id: string) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export default function MaterialCard({ material }: { material: Material }) {
  const video = material.type === "video";

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[26px] border border-olive/10 bg-white shadow-card transition duration-300 hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-soft">
      {/* Quick Bookmark Button positioned top-left */}
      <div className="absolute top-3 left-3 z-20">
        <BookmarkButton material={material} variant="icon" />
      </div>

      <Link href={`/material/${material.id}`} className="flex flex-1 flex-col">
        {/* Media / Thumbnail area */}
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
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="flex flex-1 flex-col gap-2 p-5 sm:p-6">
          <div className="flex items-center justify-between">
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
            <span>{material.downloads_count} مشاهدة/تحميل</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
