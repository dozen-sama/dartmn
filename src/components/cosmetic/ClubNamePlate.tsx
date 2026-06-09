import { cn } from "@/lib/utils"
import type { CSSProperties } from "react"

interface Props {
  name: string
  color?: string | null // клубын сонгосон неон өнгө
  score?: number // (хуучин — ашиглахгүй, дуудлагын нийцэлд үлдээв)
  orbit?: boolean // (хуучин — ашиглахгүй, дуудлагын нийцэлд үлдээв)
  compact?: boolean // жижиг (нэрний урд tag)
  className?: string
}

/**
 * Клубын tag-ийг неон хүрээтэй харуулна. Өнгө = сонгосон color эсвэл default цэнхэр.
 * Хаа сайгүй ижил (Удирдагч/Орлогч сонгож, гишүүдэд автоматаар тарна). Цэвэр CSS, хөнгөн.
 */
export function ClubNamePlate({ name, color, compact, className }: Props) {
  const neon = color || "#34d3ee"
  const style = { "--neon": neon } as CSSProperties
  return (
    <span
      className={cn("club-np", compact && "club-np-sm", className)}
      style={style}
    >
      <span className="club-np-label">{name}</span>
    </span>
  )
}
