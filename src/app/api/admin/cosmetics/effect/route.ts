import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Database } from "@/types/database"

type EffectUpdate = Database["public"]["Tables"]["cosmetic_effects"]["Update"]
type EffectInsert = Database["public"]["Tables"]["cosmetic_effects"]["Insert"]

async function requireAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  return me?.role === "admin" ? user : null
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const body = await req.json()
  const { id, key, name, lottie_text } = body
  if (!key || !name) return NextResponse.json({ error: "key, name шаардлагатай" }, { status: 400 })

  const svc = await createAdminClient()
  let lottieUrl: string | undefined = typeof body.lottie_url === "string" ? body.lottie_url : undefined

  // Шинэ Lottie файл upload (JSON текстээр)
  if (typeof lottie_text === "string" && lottie_text.trim()) {
    try { JSON.parse(lottie_text) } catch { return NextResponse.json({ error: "Буруу Lottie JSON" }, { status: 400 }) }
    const path = `effects/${key}-${Date.now()}.json`
    const { error: upErr } = await svc.storage.from("cosmetics")
      .upload(path, Buffer.from(lottie_text), { contentType: "application/json", upsert: true })
    if (upErr) return NextResponse.json({ error: "Upload: " + upErr.message }, { status: 500 })
    lottieUrl = svc.storage.from("cosmetics").getPublicUrl(path).data.publicUrl
  }

  const payload: EffectUpdate = {
    key,
    name,
    xp: Number(body.xp) || 0,
    fit: body.fit || "cover",
    scale: Number(body.scale) || 1,
    scope: body.scope || "profile",
    sort_order: Number(body.sort_order) || 0,
    is_active: body.is_active !== false,
    pass_id: body.pass_id || null,
  }
  if (lottieUrl) payload.lottie_url = lottieUrl

  if (id) {
    const { error } = await svc.from("cosmetic_effects").update(payload).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    if (!lottieUrl) return NextResponse.json({ error: "Lottie файл шаардлагатай" }, { status: 400 })
    const { error } = await svc.from("cosmetic_effects").insert(payload as EffectInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 })
  const svc = await createAdminClient()
  const { error } = await svc.from("cosmetic_effects").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
