import { cn } from "@/lib/utils"
import { getFrame } from "@/lib/frames"
import { FireFrame } from "./FireFrame"

interface Props {
  name: string
  frame?: string | null
  variant?: "full" | "compact" | "inline"
  className?: string
}

/**
 * Тоглогч/клубын нэрийг сонгосон cosmetic хүрээтэй харуулна.
 * Хүрээгүй (эсвэл "none") бол энгийн текст буцаана.
 */
export function NamePlate({ name, frame, variant = "inline", className }: Props) {
  const def = getFrame(frame)
  if (!def || def.theme === "none") {
    return <span className={className}>{name}</span>
  }
  const showFire = def.theme === "inferno" && variant === "full"
  return (
    <span className={cn("np", `np-${def.theme}`, `np-${variant}`, className)}>
      {showFire && <FireFrame />}
      <span className="np-label">{name}</span>
    </span>
  )
}
