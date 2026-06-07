import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { getFrame } from "@/lib/frames"
import { FireFrame } from "./FireFrame"

// Сонгож болох фонтууд (customize)
export const FONT_FAMILY: Record<string, string> = {
  sans: "var(--font-sans), sans-serif",
  mono: "var(--font-mono), monospace",
  heading: "var(--font-heading), sans-serif",
}

interface Props {
  name: string
  frame?: string | null
  color?: string | null
  font?: string | null
  variant?: "full" | "compact" | "inline"
  className?: string
}

/**
 * Тоглогч/клубын нэрийг сонгосон cosmetic хүрээ + өнгө/фонтоор харуулна.
 */
export function NamePlate({ name, frame, color, font, variant = "inline", className }: Props) {
  const def = getFrame(frame)

  const style: CSSProperties = {}
  if (color) style.color = color
  if (font && FONT_FAMILY[font]) style.fontFamily = FONT_FAMILY[font]
  const hasStyle = Object.keys(style).length > 0

  if (!def || def.theme === "none") {
    return <span className={className} style={hasStyle ? style : undefined}>{name}</span>
  }

  const showFire = def.theme === "inferno" && variant === "full"
  return (
    <span className={cn("np", `np-${def.theme}`, `np-${variant}`, className)}>
      {showFire && <FireFrame />}
      <span className="np-label" style={hasStyle ? style : undefined}>{name}</span>
    </span>
  )
}
