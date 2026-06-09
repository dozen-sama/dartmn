"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft, Building2, Calendar, Check, Copy, Download,
  Globe,  LogIn, MapPin, QrCode, Share2, Shield, Users,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getTier } from "@/lib/rating"
import { ClubNamePlate } from "@/components/cosmetic/ClubNamePlate"
import { formatDate, formatNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Props {
  club: {
    id: string; name: string; tag: string | null; tag_color: string | null; tagline: string | null
    description: string | null; logo_url: string | null; cover_url: string | null
    city: string | null; member_count: number; club_score: number
    features: string[]; website: string | null
    social_discord: string | null; social_facebook: string | null; social_instagram: string | null
    subscription_plan: string | null; is_verified: boolean
  }
  members: { role: string; profiles: any }[]
  tournaments: any[]
}

const PLAN_COLORS: Record<string, string> = {
  basic: "text-slate-400",
  pro: "text-primary",
  enterprise: "text-yellow-400",
}

export function ClubShowcase({ club, members, tournaments }: Props) {
  const [showQR, setShowQR] = useState(false)
  const features = Array.isArray(club.features) ? club.features as string[] : []
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/clubs/${club.id}` : ""
  const tier = getTier(club.club_score)

  function copyLink() {
    navigator.clipboard.writeText(joinUrl)
    toast.success("Холбоос хуулагдлаа")
  }

  function share() {
    if (navigator.share) {
      navigator.share({ title: club.name, text: club.tagline ?? "", url: joinUrl })
    } else copyLink()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative">
        {/* Cover */}
        <div className="h-48 sm:h-64 relative overflow-hidden">
          {club.cover_url ? (
            <img src={club.cover_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/30 via-slate-900 to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>

        {/* Back */}
        <Link href={`/clubs/${club.id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "absolute top-4 left-4 bg-background/60 backdrop-blur-sm")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Буцах
        </Link>

        {/* Share */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button onClick={share}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/60 backdrop-blur-sm text-sm hover:bg-background/80 transition-colors border border-white/10">
            <Share2 className="h-3.5 w-3.5" />
            Хуваалцах
          </button>
        </div>

        {/* Club info overlay */}
        <div className="absolute -bottom-16 left-0 right-0 px-5">
          <div className="flex items-end gap-4">
            <div className="h-24 w-24 rounded-2xl border-4 border-background overflow-hidden bg-slate-800 shrink-0 flex items-center justify-center shadow-xl">
              {club.logo_url
                ? <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
                : <Building2 className="h-10 w-10 text-muted-foreground" />}
            </div>
            <div className="pb-2 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black truncate">{club.name}</h1>
                {club.tag && (
                  <ClubNamePlate name={club.tag} color={club.tag_color} className="font-mono shrink-0" />
                )}
                {club.is_verified && (
                  <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 shrink-0 text-[10px]">
                    <Check className="h-2.5 w-2.5 mr-1" />Баталгаажсан
                  </Badge>
                )}
              </div>
              {club.subscription_plan && (
                <span className={cn("text-xs font-semibold", PLAN_COLORS[club.subscription_plan])}>
                  ✦ {club.subscription_plan.charAt(0).toUpperCase() + club.subscription_plan.slice(1)} клуб
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-20 px-5 pb-10 max-w-2xl mx-auto space-y-6">
        {/* Tagline */}
        {club.tagline && (
          <p className="text-lg font-medium leading-relaxed">{club.tagline}</p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Гишүүн", value: club.member_count },
            { label: "Клубын оноо", value: formatNumber(club.club_score) },
            { label: "Tier", value: `${tier.icon} ${tier.tier}` },
          ].map((s) => (
            <div key={s.label} className="text-center bg-secondary/30 rounded-xl py-3 px-2">
              <p className="text-xl font-black">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        {features.length > 0 && (
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5 space-y-2.5">
              <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Давуу тал</h2>
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-green-400" />
                  </div>
                  <span className="text-sm font-medium">{f}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Location + contact */}
        {(club.city || club.website) && (
          <div className="flex flex-wrap gap-3">
            {club.city && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
                <MapPin className="h-3.5 w-3.5" />{club.city}
              </div>
            )}
            {club.website && (
              <a href={club.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2 hover:bg-primary/20 transition-colors">
                <Globe className="h-3.5 w-3.5" />Вэб хуудас
              </a>
            )}
            {club.social_instagram && (
              <a href={`https://instagram.com/${club.social_instagram}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-pink-400 bg-pink-500/10 rounded-lg px-3 py-2">
                📸 Instagram
              </a>
            )}
          </div>
        )}

        {/* Active tournaments */}
        {tournaments.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Идэвхтэй тэмцээн</h2>
            {tournaments.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}`}>
                <Card className="card-hover border-border/50 bg-card/80">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.format} · {t.current_players}/{t.max_players}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                      Бүртгэл
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Members preview */}
        {members.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Гишүүд</h2>
            <div className="flex -space-x-2 flex-wrap gap-y-1">
              {members.slice(0, 8).map((m, i) => {
                const p = m.profiles
                if (!p) return null
                return (
                  <Avatar key={i} className="h-9 w-9 border-2 border-background">
                    <AvatarImage src={p.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[9px] bg-secondary">{p.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                )
              })}
              {members.length > 8 && (
                <div className="h-9 w-9 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-bold text-muted-foreground">
                  +{members.length - 8}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR + Join CTA */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">Клубт нэгдэх</h2>
                <p className="text-sm text-muted-foreground mt-0.5">QR уншуулах эсвэл холбоос дарах</p>
              </div>
              <button onClick={() => setShowQR(!showQR)}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors">
                <QrCode className="h-4 w-4" />
                {showQR ? "Нуух" : "QR код"}
              </button>
            </div>

            {showQR && (
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl">
                  <QRCodeSVG value={joinUrl} size={160} level="M" />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Link href={`/clubs/${club.id}`}
                className={cn(buttonVariants(), "flex-1 glow-primary justify-center")}>
                <LogIn className="h-4 w-4 mr-1.5" />
                Клубт нэгдэх
              </Link>
              <button onClick={copyLink}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border/60 text-sm hover:bg-secondary transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* DartMN footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            🎯 <Link href="/" className="text-primary hover:underline">DartMN</Link> — Монголын дартсын платформ
          </p>
        </div>
      </div>
    </div>
  )
}
