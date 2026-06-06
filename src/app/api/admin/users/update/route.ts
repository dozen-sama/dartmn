import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Database } from "@/types/database"

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"]
const VALID_ROLES = ["player", "club_admin", "admin", "owner"] as const

export async function POST(req: NextRequest) {
  // Дуудаж буй хэрэглэгч admin эсэхийг шалгах
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (me?.role !== "admin") return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const body = await req.json()
  const { user_id, display_name, username, phone, role, password } = body
  if (!user_id) return NextResponse.json({ error: "user_id дутуу" }, { status: 400 })

  const admin = await createAdminClient()

  // Профайлын талбаруудыг угсрах
  const updates: ProfileUpdate = {}
  if (typeof display_name === "string" && display_name.trim()) updates.display_name = display_name.trim()
  if (typeof username === "string" && username.trim()) {
    updates.username = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")
  }
  if (typeof phone === "string") updates.phone = phone.trim() || null
  if (typeof role === "string") {
    if (!(VALID_ROLES as readonly string[]).includes(role)) return NextResponse.json({ error: "Буруу эрх" }, { status: 400 })
    // Өөрийн эрхээ өөрчилж түгжихээс сэргийлэх
    if (user_id === user.id && role !== "admin") {
      return NextResponse.json({ error: "Өөрийн админ эрхээ хасах боломжгүй" }, { status: 400 })
    }
    updates.role = role as ProfileUpdate["role"]
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from("profiles").update(updates).eq("id", user_id)
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Энэ username аль хэдийн ашиглагдсан" }, { status: 409 })
      return NextResponse.json({ error: "Профайл хадгалахад алдаа" }, { status: 500 })
    }
  }

  // Нууц үг сэргээх (заавал биш)
  if (typeof password === "string" && password.length > 0) {
    if (password.length < 6) return NextResponse.json({ error: "Нууц үг дор хаяж 6 тэмдэгт" }, { status: 400 })
    const { error: pwErr } = await admin.auth.admin.updateUserById(user_id, { password })
    if (pwErr) return NextResponse.json({ error: "Нууц үг солиход алдаа: " + pwErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
