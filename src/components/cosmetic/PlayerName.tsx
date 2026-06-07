import { NamePlate } from "./NamePlate"

interface CosmeticProfile {
  display_name: string
  equipped_frame?: string | null
  name_effect?: string | null
  name_color?: string | null
  name_font?: string | null
  name_animated?: boolean | null
}

interface Props {
  p: CosmeticProfile
  variant?: "full" | "compact" | "inline"
  className?: string
}

/**
 * Тоглогчийн нэрийг nameplate (хүрээ/өнгө/фонт)-той харуулах товч wrapper.
 * Жагсаалтад inline/compact (effect автоматаар унтарна — зөвхөн full дээр).
 */
export function PlayerName({ p, variant = "inline", className }: Props) {
  return (
    <NamePlate
      name={p.display_name}
      frame={p.equipped_frame}
      effect={p.name_effect}
      color={p.name_color}
      font={p.name_font}
      animated={p.name_animated ?? true}
      variant={variant}
      className={className}
    />
  )
}

// Query-д хэрэгтэй cosmetic талбарууд (profiles select-д нэмнэ)
export const COSMETIC_FIELDS = "equipped_frame, name_effect, name_color, name_font, name_animated"
