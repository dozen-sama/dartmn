export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { Volume2 } from "lucide-react"
import { requireAdmin } from "@/lib/auth/require-admin"
import { CallerVoiceManager } from "./CallerVoiceManager"

export const metadata: Metadata = { title: "Дуут зарлагч — Админ" }

export default async function AdminCallerPage() {
  const { supabase } = await requireAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("caller_clips")
    .select("key, ext, updated_at")

  const existing: Record<string, { ext: string; updated_at: string }> = {}
  for (const row of (data ?? []) as { key: string; ext: string; updated_at: string }[]) {
    existing[row.key] = { ext: row.ext, updated_at: row.updated_at }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Volume2 className="h-6 w-6 text-primary" />
          Дуут зарлагч (caller)
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Оноо болон фраз бүрийн дуу бичлэгийг оруулна. Бичлэгтэй бол тоглолтод хүний дуугаар, дутуу бол автомат хоолойгоор хэлнэ.
        </p>
      </div>
      <CallerVoiceManager existing={existing} />
    </div>
  )
}
