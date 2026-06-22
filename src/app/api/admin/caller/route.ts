import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Дуут caller-ийн хүний дуу бичлэг (админ). POST = key-д бичлэг upload,
// DELETE = бичлэг устгах. Зөвхөн role='admin'. Файл нь caller-voice bucket-д
// <key>.<ext>, мэдээлэл caller_clips хүснэгтэд.

async function requireAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  return me?.role === "admin" ? user : null
}

const TYPE_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
}

export async function POST(req: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const form = await req.formData()
  const key = String(form.get("key") ?? "").trim()
  const file = form.get("file")
  if (!key || !(file instanceof File)) return NextResponse.json({ error: "key, file шаардлагатай" }, { status: 400 })

  const ext = TYPE_EXT[file.type] ?? (file.name.split(".").pop() || "webm").toLowerCase()
  const buf = Buffer.from(await file.arrayBuffer())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = await createAdminClient()

  // Хуучин өөр ext-тэй файлыг цэвэрлэнэ (нэг key нэг бичлэг)
  const { data: prev } = await svc.from("caller_clips").select("ext").eq("key", key).maybeSingle()
  if (prev && prev.ext !== ext) {
    await svc.storage.from("caller-voice").remove([`${key}.${prev.ext}`])
  }

  const { error: upErr } = await svc.storage.from("caller-voice")
    .upload(`${key}.${ext}`, buf, { contentType: file.type || "audio/webm", upsert: true })
  if (upErr) return NextResponse.json({ error: "Upload: " + upErr.message }, { status: 500 })

  const { error: dbErr } = await svc.from("caller_clips")
    .upsert({ key, ext, updated_at: new Date().toISOString() })
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const url = svc.storage.from("caller-voice").getPublicUrl(`${key}.${ext}`).data.publicUrl
  return NextResponse.json({ ok: true, key, ext, url: `${url}?v=${Date.now()}` })
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdminUser())) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })
  const { key } = await req.json()
  if (!key) return NextResponse.json({ error: "key шаардлагатай" }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc: any = await createAdminClient()
  const { data: row } = await svc.from("caller_clips").select("ext").eq("key", key).maybeSingle()
  if (row) await svc.storage.from("caller-voice").remove([`${key}.${row.ext}`])
  const { error } = await svc.from("caller_clips").delete().eq("key", key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
