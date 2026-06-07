import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Database } from "@/types/database"

type PassUpdate = Database["public"]["Tables"]["cosmetic_passes"]["Update"]
type PassInsert = Database["public"]["Tables"]["cosmetic_passes"]["Insert"]

async function requireAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  return me?.role === "admin" ? user : null
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const { id, name, starts_at, ends_at } = await req.json()
  if (!name) return NextResponse.json({ error: "Нэр шаардлагатай" }, { status: 400 })

  const payload: PassUpdate = {
    name,
    starts_at: starts_at || null,
    ends_at: ends_at || null,
  }

  const svc = await createAdminClient()
  if (id) {
    const { error } = await svc.from("cosmetic_passes").update(payload).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await svc.from("cosmetic_passes").insert(payload as PassInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 })
  const svc = await createAdminClient()
  const { error } = await svc.from("cosmetic_passes").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
