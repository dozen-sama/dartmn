"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity, BarChart3, Building2, Calendar, CreditCard,
  LayoutDashboard, Monitor, Trophy,
} from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/dashboard",   label: "Нүүр",       icon: LayoutDashboard },
  { href: "/tournaments", label: "Тэмцээн",     icon: Trophy },
  { href: "/play",        label: "Тоглох",      icon: Monitor,  live: true },
  { href: "/ratings",     label: "Рейтинг",     icon: BarChart3 },
  { href: "/stats",       label: "Стат",        icon: Activity },
  { href: "/clubs",       label: "Клуб",        icon: Building2 },
  { href: "/calendar",    label: "Календарь",   icon: Calendar },
  { href: "/pricing",     label: "Төлбөр",      icon: CreditCard },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border/50 bg-background/95 backdrop-blur-md">
      {/* Баруун талд fade — дороос гүйлгэх боломж байгааг илтгэнэ */}
      <div className="relative">
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background/95 to-transparent z-10" />
        <div
          className="flex overflow-x-auto h-16 px-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map(({ href, label, icon: Icon, live }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/")
            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center gap-0.5 shrink-0 w-[4.25rem] transition-colors"
              >
                {/* Идэвхтэй үзүүлэлт — дээд зураас */}
                {isActive && (
                  <span className="absolute top-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
                )}
                <div className="relative">
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-all",
                      isActive ? "text-primary scale-110" : "text-muted-foreground"
                    )}
                  />
                  {live && (
                    <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium truncate w-full text-center px-0.5",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
