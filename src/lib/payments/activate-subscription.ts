import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ActivationResult =
  | { ok: true; status: "activated" | "already_active"; expiresAt: string | null }
  | { ok: false }

// Хувийн Premium (subscription_premium)-ийг АЛЬ Ч эх сурвалжаас (BYL webhook
// эсвэл client fallback) идэвхжүүлэх цорын ганц зам. Бодит claim/upsert
// логик нь нэг Postgres транзакц дотор (activate_subscription_from_payment
// RPC, 20260829120200 migration) ажилладаг тул хоёр дуудагч зэрэг эсвэл
// давхар ирсэн ч НЭГ л удаа идэвхжинэ — "already_active" нь алдаа биш,
// зөвхөн өөр дуудагч (жишээ нь webhook) аль хэдийн идэвхжүүлсэн гэсэн үг.
export async function activateSubscriptionFromPayment(
  supabase: SupabaseClient,
  transactionId: string,
  playerId: string,
): Promise<ActivationResult> {
  const { data, error } = await supabase.rpc("activate_subscription_from_payment", {
    p_transaction_id: transactionId,
    p_player_id: playerId,
  })
  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.result === "invalid") return { ok: false }

  return { ok: true, status: row.result, expiresAt: row.expires_at }
}
