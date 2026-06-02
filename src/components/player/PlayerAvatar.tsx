import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface PlayerAvatarProps {
  displayName: string
  avatarUrl?: string | null
  clubLogoUrl?: string | null
  clubTag?: string | null
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeMap = {
  sm: { avatar: "h-7 w-7", badge: "h-3.5 w-3.5 -bottom-0.5 -right-0.5", text: "text-[8px]" },
  md: { avatar: "h-9 w-9", badge: "h-4 w-4 -bottom-0.5 -right-0.5", text: "text-[9px]" },
  lg: { avatar: "h-12 w-12", badge: "h-5 w-5 -bottom-0.5 -right-0.5", text: "text-[9px]" },
  xl: { avatar: "h-16 w-16", badge: "h-6 w-6 bottom-0 -right-0.5", text: "text-[10px]" },
}

export function PlayerAvatar({
  displayName,
  avatarUrl,
  clubLogoUrl,
  clubTag,
  size = "md",
  className,
}: PlayerAvatarProps) {
  const s = sizeMap[size]
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className={cn(s.avatar, "border border-border")}>
        <AvatarImage src={avatarUrl ?? undefined} />
        <AvatarFallback className="bg-primary/20 text-primary font-semibold text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>

      {/* Club logo badge */}
      {clubLogoUrl ? (
        <div className={cn(
          "absolute rounded-full overflow-hidden border-2 border-background bg-white",
          s.badge
        )}>
          <img src={clubLogoUrl} alt={clubTag ?? ""} className="w-full h-full object-cover" />
        </div>
      ) : clubTag ? (
        <div className={cn(
          "absolute rounded-full bg-primary border-2 border-background flex items-center justify-center font-bold text-primary-foreground",
          s.badge, s.text
        )}>
          {clubTag.slice(0, 1)}
        </div>
      ) : null}
    </div>
  )
}
