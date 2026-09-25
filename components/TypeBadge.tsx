import { MATERIAL_TYPE_LABELS, type MaterialType } from "@/lib/types";

const STYLES: Record<MaterialType, string> = {
  exam: "bg-clay/10 text-clay-dark border-clay/25",
  summary: "bg-gold/15 text-[#6b4c15] border-gold/35",
  file: "bg-olive/10 text-olive-dark border-olive/25",
  video: "bg-ink/5 text-ink border-ink/15",
};

export default function TypeBadge({ type }: { type: MaterialType }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${STYLES[type]}`}
    >
      {MATERIAL_TYPE_LABELS[type]}
    </span>
  );
}
