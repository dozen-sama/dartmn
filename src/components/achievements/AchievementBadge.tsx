import { cn } from "@/lib/utils"

export interface Achievement {
  key: string
  name: string
  description: string
  icon: string
  category: string
  earned_at?: string
}

interface AchievementBadgeProps {
  achievement: Achievement
  earned?: boolean
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}

const categoryColors: Record<string, string> = {
  match:      "border-blue-500/40 bg-blue-500/10",
  tournament: "border-yellow-500/40 bg-yellow-500/10",
  score:      "border-purple-500/40 bg-purple-500/10",
  rating:     "border-primary/40 bg-primary/10",
  special:    "border-green-500/40 bg-green-500/10",
}

export function AchievementBadge({ achievement, earned = true, size = "md", showLabel = false }: AchievementBadgeProps) {
  const color = categoryColors[achievement.category] ?? categoryColors.special
  const sizes = { sm: "h-8 w-8 text-base", md: "h-11 w-11 text-2xl", lg: "h-14 w-14 text-3xl" }

  return (
    <div className={cn("flex flex-col items-center gap-1", !earned && "opacity-30 grayscale")}>
      <div className={cn(
        "rounded-xl border-2 flex items-center justify-center transition-all",
        sizes[size],
        earned ? color : "border-border/30 bg-secondary/30",
        earned ? "shadow-sm" : ""
      )}>
        <span>{achievement.icon}</span>
      </div>
      {showLabel && (
        <p className={cn("font-medium text-center leading-tight",
          size === "sm" ? "text-[9px] max-w-[40px]" : size === "md" ? "text-[10px] max-w-[52px]" : "text-xs max-w-[64px]")}>
          {achievement.name}
        </p>
      )}
    </div>
  )
}

export function AchievementTooltip({ achievement, earned }: { achievement: Achievement; earned: boolean }) {
  return (
    <div className="group relative">
      <AchievementBadge achievement={achievement} earned={earned} />
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 min-w-[140px]">
        <div className="bg-popover border border-border rounded-lg px-2.5 py-2 shadow-lg text-center">
          <p className="text-xs font-semibold">{achievement.icon} {achievement.name}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{achievement.description}</p>
          {!earned && <p className="text-[10px] text-muted-foreground/60 mt-1">Нээгдээгүй</p>}
          {earned && achievement.earned_at && (
            <p className="text-[10px] text-primary/70 mt-1">
              {new Date(achievement.earned_at).toLocaleDateString("mn-MN")}
            </p>
          )}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-border" />
      </div>
    </div>
  )
}
