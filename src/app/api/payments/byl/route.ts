import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { resolveExpectedAmount } from "@/lib/payments/validate-amount"

const BYL_BASE = "https://byl.mn/api/v1"
const BYL_TOKEN = process.env.BYL_TOKEN ?? ""
const BYL_PROJECT_ID = process.env.BYL_PROJECT_ID ?? ""

// Төлбөр амжилттай/цуцлагдсаны дараа BYL хэрэглэгчийг буцааж илгээх хаяг.
// Checkouts API-ийн success_url/cancel_url-д ашиглана (docs: byl.mn/docs/api/checkouts.html) —
// Invoices API-д ийм талбар байхгүй тул хэрэглэгч BYL-ийн hosted хуудсан дээр
// "гацдаг" (dartmn руу автоматаар буцаж ирдэггүй) байсныг эндээс шийднэ.
//
// Subscription-ий хувьд success_url-г шууд /profile руу биш, ЭХНИЙ checkout
// хуудас руугаа (returnPath) буцаадаг — учир нь тухайн хуудасны useBylInvoice
// mount-effect л localStorage-с txnId уншиж "Төлбөр амжилттай!" баталгаажуулах
// дэлгэц харуулаад, /api/subscriptions/activate-г дуудаж premium-г идэвхжүүлдэг.
// Шууд /profile руу үсэрвэл энэ бүх логик алгасагдаж, хэрэглэгч "төлсөн ч юу ч
// болоогүй мэт" profile хуудсан дээр гарч ирдэг байсныг эндээс засав.
function buildRedirectUrls(origin: string, purpose: string | undefined, tournamentId: string | null, returnPath: string | null) {
  if (typeof purpose === "string" && purpose.startsWith("subscription_")) {
    const safeReturnPath = returnPath && returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/profile"
    return { success_url: `${origin}${safeReturnPath}`, cancel_url: `${origin}/pricing` }
  }
  if (tournamentId) {
    return { success_url: `${origin}/tournaments/${tournamentId}`, cancel_url: `${origin}/tournaments/${tournamentId}` }
  }
  return { success_url: `${origin}/`, cancel_url: `${origin}/` }
}

export async function POST(req: NextRequest) {
  if (!BYL_TOKEN || !BYL_PROJECT_ID) {
    return NextResponse.json({ error: "byl.mn гэрээ хийгдээгүй байна" }, { status: 503 })
  }

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: "Нэвтрээгүй байна" }, { status: 401 })

  const { tournament_id, player_id, amount, purpose, return_path } = await req.json()
  // Subscription худалдан авалт (жишээ нь "subscription_premium") нь ямар ч
  // тэмцээнтэй холбоогүй тул tournament_id шаардахгүй. payment_transactions.
  // tournament_id багана null зөвшөөрдөг (FK ON DELETE SET NULL) — өмнө нь
  // checkout хуудас байхгүй тэмцээний sentinel UUID дамжуулж FK constraint
  // зөрчиж байсныг доор null болгож засав.
  const isSubscription = typeof purpose === "string" && purpose.startsWith("subscription_")
  if (!player_id || typeof amount !== "number" || amount < 0 || (!isSubscription && !tournament_id)) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }
  if (player_id !== user.id) return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 })

  const supabase = await createAdminClient()

  const expected = await resolveExpectedAmount(supabase, tournament_id, purpose)
  if (expected === null || amount !== expected) {
    return NextResponse.json({ error: "Дүн зөрсөн байна" }, { status: 400 })
  }

  const { data: txn, error: txnErr } = await supabase
    .from("payment_transactions")
    .insert({
      player_id,
      tournament_id: isSubscription ? null : tournament_id,
      amount,
      currency: "MNT",
      provider: "byl",
      status: "pending",
      metadata: purpose ? { purpose } : {},
    })
    .select("id")
    .single()

  if (txnErr || !txn) {
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  try {
    const description = purpose === "platform_fee"
      ? `DartMN платформ шимтгэл`
      : `DartMN тэмцааний хураамж`

    const { success_url, cancel_url } = buildRedirectUrls(
      req.nextUrl.origin,
      purpose,
      tournament_id ?? null,
      typeof return_path === "string" ? return_path : null,
    )

    // Invoices API (/invoices)-аас Checkouts API (/checkouts) руу шилжив —
    // сүүлийнх нь success_url/cancel_url дэмждэг цорын ганц BYL endpoint
    // (docs: byl.mn/docs/api/checkouts.html). client_reference_id нь манай
    // дотоод txn.id-г шууд, зориулалтын талбараар дамжуулах боломж өгдөг тул
    // өмнөх шиг тайлбар (description) талбарт UUID шигтгэх "[uuid]" hack
    // хэрэггүй болсон — webhook талд client_reference_id-аар шууд тааруулна.
    const res = await fetch(`${BYL_BASE}/projects/${BYL_PROJECT_ID}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BYL_TOKEN}`,
      },
      body: JSON.stringify({
        items: [
          {
            price_data: {
              unit_amount: amount,
              product_data: { name: description },
            },
            quantity: 1,
          },
        ],
        client_reference_id: txn.id,
        success_url,
        cancel_url,
      }),
    })

    const rawBody = await res.text()
    let parsed: { data?: { id?: string | number; url?: string } } = {}
    try {
      parsed = JSON.parse(rawBody)
    } catch {
      // BYL error responses are not always JSON (e.g. an HTML/plain-text
      // gateway error) — fall through with an empty object, rawBody is
      // still logged below for diagnosis.
    }
    // BYL wraps the checkout under a top-level "data" key
    // (confirmed live: {"data":{"id":73310,"url":"https://byl.mn/h/..."}}),
    // not at the response root.
    const checkout = parsed.data ?? {}

    if (checkout.id && checkout.url) {
      await supabase
        .from("payment_transactions")
        .update({ invoice_id: String(checkout.id) })
        .eq("id", txn.id)

      return NextResponse.json({
        transaction_id: txn.id,
        invoice_id: checkout.id,
        payment_url: checkout.url,
      })
    }

    // res.status/rawBody-г серверийн лог руу бичиж байна — client рүү буцаах
    // алдааны мэдээлэл товч ("byl.mn invoice амжилтгүй") учир Vercel logs
    // шалгахгүйгээр бодит шалтгааныг (401 буруу token, 404 буруу project id
    // гэх мэт) олж харах боломжгүй байсныг засав.
    console.error("[byl] checkout creation failed", { status: res.status, body: rawBody.slice(0, 2000) })
    return NextResponse.json({ error: "byl.mn invoice амжилтгүй", details: parsed }, { status: 502 })
  } catch (err) {
    console.error("[byl] API request threw", err)
    return NextResponse.json({ error: "byl.mn API холболтын алдаа" }, { status: 502 })
  }
}
