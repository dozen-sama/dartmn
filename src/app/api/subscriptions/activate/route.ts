import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Premium идэвхжүүлэлт — зөвхөн БОДИТ, тухайн хэрэглэгчийн НЭРИЙН ДЭЭР "paid" болсон,
// урьд ашиглагдаагүй гүйлгээгээр л зөвшөөрнө. Хэн ч player_id/transaction_id зохион
// оруулж чөлөөтэй Premium авах цоорхойг хаана (өмнө нь ямар ч баталгаажуулалтгүй байсан).
export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { player_id, transaction_id } = await req.json()
  if (!player_id || !transaction_id) return NextResponse.json({ error: "Missing params" }, { status: 400 })
  if (player_id !== user.id) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const supabase = await createAdminClient()

  const { data: txn } = await supabase
    .from("payment_transactions")
    .select("id, player_id, status, amount, metadata")
    .eq("id", transaction_id)
    .single()

  // Зөвхөн хувийн Premium багц ("subscription_premium") энэ route-оор идэвхжинэ.
  // Клубын багцууд (subscription_basic/pro/enterprise) өөр зорилготой (clubs.subscription_plan)
  // тул энд зөвшөөрвөл клубын багц авсан хэрэглэгч буруугаар хувийн Premium авах цоорхой үүснэ.
  const purpose = (txn?.metadata as { purpose?: string } | null)?.purpose
  if (!txn || txn.player_id !== user.id || txn.status !== "paid" || purpose !== "subscription_premium") {
    return NextResponse.json({ error: "Хүчингүй буюу дуусаагүй төлбөр" }, { status: 400 })
  }

  // Давхар идэвхжүүлэлт (replay) хамгаалалт — гүйлгээ бүрийг ердөө НЭГ л удаа
  // "ашигласан" гэж тэмдэглэнэ (player_subscriptions-ийн сүүлийн payment_id-тай
  // харьцуулах хуучин арга нь 2 хүчинтэй гүйлгээг ээлжлэн ашиглаж мөнхөд
  // сунгах боломж үлдээдэг байсан). WHERE consumed_at IS NULL нөхцөлтэй энэ
  // conditional UPDATE Postgres мөрийн lock ашиглан атомик тул давхар/зэрэг
  // хүсэлт хоёулаа энэ гүйлгээг зөвхөн нэг л удаа ашиглаж чадна.
  const { data: consumed } = await supabase
    .from("payment_transactions")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", transaction_id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle()
  if (!consumed) {
    return NextResponse.json({ error: "Энэ гүйлгээ аль хэдийн ашиглагдсан" }, { status: 409 })
  }

  const expires = new Date()
  expires.setMonth(expires.getMonth() + 1)

  await supabase.from("player_subscriptions").upsert({
    player_id: user.id,
    status: "active",
    expires_at: expires.toISOString(),
    amount: txn.amount,
    payment_id: transaction_id,
  }, { onConflict: "player_id" })

  await supabase.from("profiles").update({
    is_premium: true,
    premium_expires_at: expires.toISOString(),
  }).eq("id", user.id)

  return NextResponse.json({ ok: true })
}
