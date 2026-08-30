import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { activateSubscriptionFromPayment } from "@/lib/payments/activate-subscription"

// Premium идэвхжүүлэлтийн НӨӨЦ зам (fallback/recovery) — BYL webhook нь одоо
// тухайн invoice.paid ирмэгц шууд идэвхжүүлдэг (server-authoritative, browser
// шаардахгүй, src/app/api/payments/byl/webhook/route.ts). Энэ route зөвхөн
// browser буцаж ирсэн үед checkout UX-г түргэсгэх зорилготой, идэвхжүүлэлтийн
// цорын ганц эх сурвалж биш. Бодит claim/upsert логик нь webhook-тэй ХАМТ
// ашигладаг activateSubscriptionFromPayment (нэг Postgres RPC транзакц) дотор
// байгаа тул webhook аль хэдийн идэвхжүүлсэн байсан ч энд алдаа гарахгүй,
// зүгээр "already_active" буцаана.
export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { player_id, transaction_id } = await req.json()
  if (!player_id || !transaction_id) return NextResponse.json({ error: "Missing params" }, { status: 400 })
  if (player_id !== user.id) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const supabase = await createAdminClient()

  try {
    const result = await activateSubscriptionFromPayment(supabase, transaction_id, user.id)
    if (!result.ok) {
      return NextResponse.json({ error: "Хүчингүй буюу дуусаагүй төлбөр" }, { status: 400 })
    }
    return NextResponse.json({ ok: true, status: result.status, expiresAt: result.expiresAt })
  } catch (err) {
    console.error("[subscriptions/activate] activation threw", err)
    return NextResponse.json({ error: "Серверийн алдаа" }, { status: 500 })
  }
}
