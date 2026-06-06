import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

const VALID_ROLES = ["player", "club_admin", "admin", "owner"] as const

export async function POST(req: NextRequest) {
  // Дуудаж буй хэрэглэгч admin эсэхийг шалгах
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (me?.role !== "admin") return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const { user_id, role } = await req.json()
  if (!user_id || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Буруу утга" }, { status: 400 })
  }

  // Өөрийнхөө эрхийг өөрчилж түгжихээс сэргийлэх
  if (user_id === user.id) {
    return NextResponse.json({ error: "Өөрийн эрхээ өөрчлөх боломжгүй" }, { status: 400 })
  }

  // RLS алгасан service role-оор шинэчлэх
  const admin = await createAdminClient()
  const { error } = await admin.from("profiles").update({ role }).eq("id", user_id)
  if (error) {
    return NextResponse.json({ error: "Хадгалахад алдаа гарлаа" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
