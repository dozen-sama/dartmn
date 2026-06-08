import { cn } from "@/lib/utils"
import type { CSSProperties } from "react"

interface Props {
  name: string
  color?: string | null // клубын сонгосон неон өнгө
  score?: number // (хуучин — ашиглахгүй, дуудлагын нийцэлд үлдээв)
  orbit?: boolean // premium (subscription) → dart orbit
  compact?: boolean // жижиг (нэрний урд tag)
  className?: string
}

/**
 * Клубын tag-ийг неон хүрээтэй харуулна. Өнгө = сонгосон color эсвэл default цэнхэр.
 * Хаа сайгүй ижил (Удирдагч/Орлогч сонгож, гишүүдэд автоматаар тарна). Цэвэр CSS, хөнгөн.
 */
export function ClubNamePlate({ name, color, orbit, compact, className }: Props) {
  const neon = color || "#34d3ee"
  const style = { "--neon": neon } as CSSProperties
  return (
    <span
      className={cn("club-np", compact && "club-np-sm", orbit && "club-np-orbit", className)}
      style={style}
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
