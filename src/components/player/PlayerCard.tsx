"use client"

import { MapPin, Target, Trophy, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Profile } from "@/types/database"
import { getTier, getProgress } from "@/lib/rating"
import { TierBadge } from "@/components/rating/TierBadge"
import { AchievementTooltip, Achievement } from "@/components/achievements/AchievementBadge"
import { formatNumber, formatAverage, formatPercentage } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface PlayerCardProps {
  profile: Pick<Profile,
    "id" | "username" | "display_name" | "avatar_url" | "rating_points"
    | "matches_played" | "matches_won" | "average_score" | "checkout_percentage"
    | "count_180" | "highest_checkout" | "tournament_wins" | "city" | "province"
  >
  achievements: Achievement[]
  earnedKeys: string[]
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center bg-black/30 rounded-xl p-3 gap-0.5">
      <p className="text-xl font-black score-display tracking-tight">{value}</p>
      <p className="text-[10px] text-white/60 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[10px] text-white/40">{sub}</p>}
    </div>
  )
}

export function PlayerCard({ profile: p, achievements, earnedKeys }: PlayerCardProps) {
  const tier = getTier(p.rating_points)
  const progress = getProgress(p.rating_points)
  const winRate = p.matches_played > 0 ? (p.matches_won / p.matches_played) * 100 : 0
  const earned = achievements.filter((a) => earnedKeys.includes(a.key))
  const topAchievements = earned.slice(0, 8)

  return (
    <div className={cn(
      "relative w-full max-w-sm rounded-2xl overflow-hidden text-white",
      "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
      "border border-white/10 shadow-2xl"
    )}>
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={cn("absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-20", tier.bg)} />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full blur-3xl opacity-10 bg-primary" />
      </div>

      {/* Tier banner */}
      <div className="relative px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-2xl">{tier.icon}</span>
          <div>
            <p className={cn("text-xs font-bold uppercase tracking-widest", tier.color)}>{tier.tier}</p>
            <p className="text-[10px] text-white/40">DartMN Rating</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black score-display">{formatNumber(p.rating_points)}</p>
          <p className="text-[10px] text-white/40">Rating Points</p>
        </div>
      </div>

      {/* Rating progress bar */}
      <div className="px-5 pb-3">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", tier.bg.replace("/15", "/60"))}
            style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Avatar + Name */}
      <div className="relative px-5 pb-4 flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-16 w-16 border-2 border-white/20">
            <AvatarFallback className="bg-white/10 text-white text-xl font-bold">
              {p.display_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Online dot */}
          <div className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-400 border-2 border-slate-900" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black truncate">{p.display_name}</h2>
          <p className="text-sm text-white/50">@{p.username}</p>
          {(p.province || p.city) && (
            <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {[p.province, p.city].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <TierBadge rating={p.rating_points} size="sm" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-4 pb-4 grid grid-cols-4 gap-2">
        <StatBox label="Average" value={formatAverage(p.average_score)} />
        <StatBox label="Win Rate" value={`${Math.round(winRate)}%`} sub={`${p.matches_won}W`} />
        <StatBox label="180s" value={p.count_180} />
        <StatBox label="Best CO" value={p.highest_checkout || "—"} />
      </div>

      {/* Secondary stats */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center bg-white/5 rounded-lg py-2">
          <p className="text-sm font-bold score-display">{p.matches_played}</p>
          <p className="text-[10px] text-white/40">Тоглолт</p>
        </div>
        <div className="flex flex-col items-center bg-white/5 rounded-lg py-2">
          <p className="text-sm font-bold score-display text-yellow-400">{p.tournament_wins}</p>
          <p className="text-[10px] text-white/40">Аварга</p>
        </div>
        <div className="flex flex-col items-center bg-white/5 rounded-lg py-2">
          <p className="text-sm font-bold score-display text-green-400">{earned.length}</p>
          <p className="text-[10px] text-white/40">Achievement</p>
        </div>
      </div>

      {/* Achievements row */}
      {topAchievements.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Achievements</p>
          <div className="flex gap-2 flex-wrap">
            {topAchievements.map((a) => (
              <AchievementTooltip key={a.key} achievement={a} earned={true} />
            ))}
            {earned.length > 8 && (
              <div className="h-11 w-11 rounded-xl border-2 border-white/20 bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                +{earned.length - 8}
              </div>
            )}
          </div>
        </div>
      )}

      {/* DartMN watermark */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <p className="text-[10px] text-white/20">dartmn.com</p>
        <div className="flex items-center gap-1">
          <Target className="h-3 w-3 text-primary/50" />
          <p className="text-[10px] text-white/20 font-bold">DartMN</p>
        </div>
      </div>
    </div>
  )
}
