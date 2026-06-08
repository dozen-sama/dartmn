import { getClubTier } from "@/lib/club-tier"
import { cn } from "@/lib/utils"
import type { CSSProperties } from "react"

interface Props {
  name: string
  score?: number // club_score → зэрэглэлийн өнгө
  orbit?: boolean // premium (subscription) → dart orbit
  className?: string
}

/**
 * Клубын нэр/tag-ийг неон хүрээтэй (зэрэглэлийн өнгө) харуулна.
 * orbit=true үед тойрон эргэх цэгүүд (premium). Бүгд цэвэр CSS, хөнгөн.
 */
export function ClubNamePlate({ name, score = 0, orbit, className }: Props) {
  const tier = getClubTier(score)
  const style = { "--neon": tier.color } as CSSProperties
  return (
    <span className={cn("club-np", orbit && "club-np-orbit", className)} style={style} title={`Зэрэглэл: ${tier.name}`}>
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
