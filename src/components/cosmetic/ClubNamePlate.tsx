import { getClubTier } from "@/lib/club-tier"
import { cn } from "@/lib/utils"
import type { CSSProperties } from "react"

interface Props {
  name: string
  score?: number // club_score → зэрэглэлийн өнгө. Байхгүй бол default неон
  orbit?: boolean // premium (subscription) → dart orbit
  compact?: boolean // жижиг (нэрний урд tag)
  className?: string
}

/**
 * Клубын tag-ийг неон хүрээтэй харуулна. score өгвөл зэрэглэлийн өнгө, эс бол default цэнхэр неон.
 * Цэвэр CSS, хөнгөн. Тоглогчийн нэрний урд (compact) болон клубын хуудсанд хэрэглэнэ.
 */
export function ClubNamePlate({ name, score, orbit, compact, className }: Props) {
  const tier = typeof score === "number" ? getClubTier(score) : null
  const color = tier?.color ?? "#34d3ee"
  const style = { "--neon": color } as CSSProperties
  return (
    <span
      className={cn("club-np", compact && "club-np-sm", orbit && "club-np-orbit", className)}
      style={style}
      title={tier ? `Зэрэглэл: ${tier.name}` : undefined}
    >
      {orbit && (
        <>
          <span className="club-dart" aria-hidden />
          <span className="club-dart" aria-hidden />
          <span className="club-dart" aria-hidden />
        </>
      )}
      <span className="club-np-label">{name}</span>
    </span>
  )
}
