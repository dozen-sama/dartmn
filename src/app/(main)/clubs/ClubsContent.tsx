"use client"

import { useState } from "react"
import Link from "next/link"
import { Building2, MapPin, Plus, Search, Shield, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Club, Profile } from "@/types/database"
import { mn } from "@/locales/mn"
import { cn } from "@/lib/utils"

type ClubWithOwner = Club & {
  profiles: Pick<Profile, "display_name" | "username" | "avatar_url"> | null
}

interface Props {
  clubs: ClubWithOwner[]
}

export function ClubsContent({ clubs }: Props) {
  const [search, setSearch] = useState("")

  const q = search.toLowerCase().trim()
  const filtered = !q ? clubs : clubs.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    c.city?.toLowerCase().includes(q) ||
    c.description?.toLowerCase().includes(q) ||
    c.tag?.toLowerCase().includes(q) ||          // tag-аар хайх: BTEG
    c.tagline?.toLowerCase().includes(q) ||       // tagline-аар хайх
    c.address?.toLowerCase().includes(q)          // хаягаар хайх
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            {mn.club.title}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {q && filtered.length !== clubs.length
              ? `${filtered.length} / ${clubs.length} клуб`
              : `${clubs.length} клуб бүртгэлтэй`}
          </p>
        </div>
        <Link href="/clubs/create" className={cn(buttonVariants(), "glow-primary shrink-0")}>
          <Plus className="h-4 w-4 mr-1.5" />
          {mn.club.create}
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Клуб хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/50 border-border/60"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="font-medium text-muted-foreground">Клуб олдсонгүй</p>
            <Link href="/clubs/create" className={cn(buttonVariants(), "mt-5")}>
              <Plus className="h-4 w-4 mr-1.5" />
              Клуб үүсгэх
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((club) => (
            <Link key={club.id} href={`/clubs/${club.id}`}>
              <Card className="card-hover border-border/50 bg-card/80 h-full overflow-hidden">
                {/* Cover */}
                <div className="h-24 bg-gradient-to-r from-primary/20 to-secondary overflow-hidden relative">
                  {club.cover_url && (
                    <img src={club.cover_url} alt={club.name} className="w-full h-full object-cover opacity-60" />
                  )}
                  {club.is_verified && (
                    <Badge className="absolute top-2 right-2 bg-primary/80 text-xs border-0">
                      <Shield className="h-3 w-3 mr-1" />
                      Баталгаажсан
                    </Badge>
                  )}
                </div>

                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3 -mt-8">
                    <Avatar className="h-14 w-14 border-2 border-background shrink-0">
                      <AvatarImage src={club.logo_url ?? undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                        {club.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 mt-8">
                      <h3 className="font-semibold truncate">{club.name}</h3>
                      {club.city && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {club.city}
                        </p>
                      )}
                    </div>
                  </div>

                  {club.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{club.description}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {club.member_count} гишүүн
                    </span>
                    {club.profiles && (
                      <span className="truncate ml-2">
                        Эзэн: {club.profiles.display_name}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
