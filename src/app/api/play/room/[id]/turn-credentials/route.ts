import { createClient, createAdminClient } from "@/lib/supabase/server"
import { isValidIceServers } from "@/lib/webrtc/ice-servers"
import { isUuid } from "@/lib/http/uuid"
import { NextRequest, NextResponse } from "next/server"

// Cloudflare Realtime TURN — богино хугацааны ICE credential mint хийнэ.
// TTL 24 цаг: Cloudflare-ийн баримт бичгийн жишээ утга (дээд хязгаар зарлаагүй),
// DartMN-ийн бодит тоглолтын үргэлжлэх хугацаанаас хавьгүй урт тул periodic
// refresh шаардлагагүй (нэг WebRTC session-д нэг л удаа mint хийнэ).
const TURN_TTL_SECONDS = 86400

// Амжилттай/амжилтгүй ХАМТ — credential-той хариу хэзээ ч кэшлэгдэхгүй.
function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // room_players.room_id бол uuid багана — room_code (жишээ нь "B3E5C4") гэх
  // мэт буруу төрлийн id-г шууд .eq()-д дамжуулбал Postgres query error
  // (invalid input syntax for type uuid) буцаадаг байсан бөгөөд хуучин код
  // энэ алдааг чимээгүй хаяж, "гишүүнчлэлгүй" (403)-той ялгаагүй харагддаг
  // байсан. Production incident-ээр батлагдсан — доор энэ хоёрыг ил тод ялгана.
  if (!isUuid(id)) return json({ error: "Буруу өрөөний ID" }, 400)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: "Нэвтрээгүй байна" }, 401)

  const admin = await createAdminClient()
  const { data: mine, error: membershipError } = await admin.from("room_players")
    .select("id").eq("room_id", id).eq("player_id", user.id).maybeSingle()
  if (membershipError) {
    // Sanitized — Postgres/Supabase-ийн бодит алдааны текст (schema, багана
    // нэр гэх мэт) клиент рүү хэзээ ч гарахгүй, зөвхөн серверийн лог руу.
    console.error("[turn-credentials] room_players membership query алдаа:", membershipError.code)
    return json({ error: "Гишүүнчлэл шалгаж чадсангүй" }, 502)
  }
  if (!mine) return json({ error: "Та энэ өрөөнд байхгүй" }, 403)

  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN
  if (!keyId || !apiToken) {
    console.error("[turn-credentials] Cloudflare TURN env тохируулагдаагүй")
    return json({ error: "TURN service тохируулагдаагүй" }, 503)
  }

  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
      },
    )
    if (!res.ok) {
      // Cloudflare-ийн хариу (credential/token агуулж болзошгүй) хэзээ ч логлохгүй — статус код л хангалттай
      console.error(`[turn-credentials] Cloudflare API алдаа: ${res.status}`)
      return json({ error: "TURN credential авч чадсангүй" }, 502)
    }
    const data = await res.json()
    // Client тал өөрөө дахин баталгаажуулдаг ч сервер талд эхнээс шүүх нь
    // буруу бүтэцтэй payload-ийг эх үүсвэрээс нь хаана гэсэн үг — defense in depth.
    if (!isValidIceServers(data?.iceServers)) {
      console.error("[turn-credentials] Cloudflare хариу буруу бүтэцтэй")
      return json({ error: "TURN credential авч чадсангүй" }, 502)
    }
    return json({ iceServers: data.iceServers }, 200)
  } catch {
    console.error("[turn-credentials] Cloudflare-тэй холбогдож чадсангүй")
    return json({ error: "TURN credential авч чадсангүй" }, 502)
  }
}
