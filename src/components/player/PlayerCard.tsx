"use client"

import { useRef, useState } from "react"
import { Download, Loader2, MapPin, Target, Trophy } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Profile } from "@/types/database"
import { getTier, getProgress } from "@/lib/rating"
import { AchievementTooltip, Achievement } from "@/components/achievements/AchievementBadge"
import { formatNumber, formatAverage } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PlayerCardProps {
  profile: Pick<Profile,
    "id" | "username" | "display_name" | "avatar_url" | "rating_points"
    | "matches_played" | "matches_won" | "average_score" | "checkout_percentage"
    | "count_180" | "highest_checkout" | "tournament_wins" | "city" | "province"
    | "primary_club_logo" | "primary_club_tag"
  >
  achievements: Achievement[]
  earnedKeys: string[]
  clubName?: string | null
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

export function PlayerCard({ profile: p, achievements, earnedKeys, clubName }: PlayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const tier = getTier(p.rating_points)
  const progress = getProgress(p.rating_points)
  const winRate = p.matches_played > 0 ? (p.matches_won / p.matches_played) * 100 : 0
  const earned = achievements.filter((a) => earnedKeys.includes(a.key))
  const topAchievements = earned.slice(0, 8)

  const now = new Date()
  const dateStr = now.toLocaleDateString("mn-MN", { year: "numeric", month: "long", day: "numeric" })

  async function downloadCard() {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      // Dynamic import to avoid SSR issues
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,        // 2x resolution for crisp output
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: cardRef.current.offsetWidth,
        height: cardRef.current.offsetHeight,
      })
      const link = document.createElement("a")
      link.download = `dartmn-${p.username}-${now.getFullYear()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
      toast.success("Карт татагдлаа!")
    } catch (err) {
      toast.error("Татахад алдаа гарлаа")
    }
    setDownloading(false)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Card */}
      <div
        ref={cardRef}
        className={cn(
          "relative w-[340px] rounded-2xl overflow-hidden text-white",
          "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
          "border border-white/10 shadow-2xl"
        )}
        style={{ fontFamily: "'Inter', 'Noto Sans Mongolian', sans-serif" }}
      >
        {/* Background glow */}
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

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full", tier.bg.replace("/15", "/60"))}
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Avatar + Name */}
        <div className="relative px-5 pb-4 flex items-center gap-4">
          {/* Avatar with club logo badge */}
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-full border-2 border-white/20 bg-white/10 overflow-hidden flex items-center justify-center">
              {p.avatar_url
                ? <img src={p.avatar_url} alt={p.display_name} className="h-full w-full object-cover" />
                : <span className="text-xl font-black text-white">{p.display_name.slice(0, 2).toUpperCase()}</span>
              }
            </div>
            {/* Club logo badge */}
            {p.primary_club_logo ? (
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-slate-900 overflow-hidden bg-white">
                <img src={p.primary_club_logo} alt="" className="h-full w-full object-cover" />
              </div>
            ) : p.primary_club_tag ? (
              <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border-2 border-slate-900 bg-primary flex items-center justify-center">
                <span className="text-[9px] font-black text-white">{p.primary_club_tag.slice(0, 1)}</span>
              </div>
            ) : null}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {p.primary_club_tag && (
                <span className="text-[10px] font-mono text-white/50">[{p.primary_club_tag}]</span>
              )}
              <h2 className="text-lg font-black truncate">{p.display_name}</h2>
            </div>
            <p className="text-sm text-white/50">@{p.username}</p>
            {(p.province || p.city) && (
              <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5">
                <MapPin className="h-2.5 w-2.5" />
                {[p.province, p.city].filter(Boolean).join(" · ")}
              </p>
            )}
            {clubName && (
              <p className="text-[11px] text-white/40 mt-0.5">🏠 {clubName}</p>
            )}
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

        {/* Achievements */}
        {topAchievements.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Achievements</p>
            <div className="flex gap-2 flex-wrap">
              {topAchievements.map((a) => (
                <div key={a.key}
                  className="h-9 w-9 rounded-xl border-2 border-white/20 bg-white/10 flex items-center justify-center text-base"
                  title={a.name}>
                  {a.icon}
                </div>
              ))}
              {earned.length > 8 && (
                <div className="h-9 w-9 rounded-xl border-2 border-white/20 bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                  +{earned.length - 8}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer: DartMN + date */}
        <div className="px-4 pb-3 flex items-center justify-between border-t border-white/10 pt-2.5">
          <div className="flex items-center gap-1">
            <Target className="h-3 w-3 text-primary/60" />
            <p className="text-[10px] text-white/30 font-bold">DartMN</p>
          </div>
          <p className="text-[10px] text-white/30">{dateStr}</p>
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={downloadCard}
        disabled={downloading}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90 glow-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {downloading
          ? <><Loader2 className="h-4 w-4 animate-spin" />Татаж байна...</>
          : <><Download className="h-4 w-4" />PNG татах</>
        }
      </button>
      <p className="text-xs text-muted-foreground">Зургийг хадгалаад найзуудтайгаа хуваалцаарай</p>
    </div>
  )
}
