import { getTier, getProgress, TierInfo } from "@/lib/rating"
import { cn } from "@/lib/utils"

interface TierBadgeProps {
  rating: number
  showProgress?: boolean
  size?: "sm" | "md" | "lg"
}

export function TierBadge({ rating, showProgress = false, size = "md" }: TierBadgeProps) {
  const tier = getTier(rating)
  const progress = getProgress(rating)

  const sizes = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2",
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <span className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        tier.bg, tier.border, tier.color, sizes[size]
      )}>
        <span>{tier.icon}</span>
        <span>{tier.tier}</span>
      </span>
      {showProgress && tier.nextMin && (
        <div className="w-full">
          <div className="h-1 rounded-full bg-border/50 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", tier.bg.replace("/15", ""))}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {rating} / {tier.nextMin} pts → {TIER_NAMES[TIERS.indexOf(tier) + 1]}
          </p>
        </div>
      )}
    </div>
  )
}

import { TIERS } from "@/lib/rating"
const TIER_NAMES = TIERS.map((t) => t.tier)
