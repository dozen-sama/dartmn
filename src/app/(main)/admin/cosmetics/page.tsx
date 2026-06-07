export const dynamic = "force-dynamic"

import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Sparkles } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth/require-admin"
import { cn } from "@/lib/utils"
import { AdminCosmetics } from "./AdminCosmetics"

export const metadata: Metadata = { title: "Cosmetics — Админ" }

export default async function AdminCosmeticsPage() {
  const { supabase } = await requireAdmin()

  const [{ data: passes }, { data: effects }] = await Promise.all([
    supabase.from("cosmetic_passes").select("id, name, starts_at, ends_at").order("created_at", { ascending: false }),
    supabase.from("cosmetic_effects").select("id, key, name, lottie_url, xp, fit, scale, offset_x, offset_y, scope, pass_id, sort_order, is_active").order("sort_order"),
  ])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Cosmetics — Effect / Pass
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Effect upload, XP үнэ, fit/scale, pass хугацаа удирдах</p>
        </div>
      </div>

      <AdminCosmetics passes={passes ?? []} effects={effects ?? []} />
    </div>
  )
}
