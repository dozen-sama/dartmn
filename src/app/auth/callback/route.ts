import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

// Vercel-ийн proxy-ийн ард request.url-ийн origin нь публик домайнтай
// (жишээ нь dartmn.com) биш дотоод deployment URL байж болзошгүй тул
// x-forwarded-host-ийг эхэнд нь ашиглана — эс бөгөөс redirect буруу
// домайн руу очиж, тэнд session cookie байхгүй тул дахин /login-д буцна.
function resolveOrigin(request: NextRequest) {
  const requestOrigin = new URL(request.url).origin
  const forwardedHost = request.headers.get("x-forwarded-host")
  if (!forwardedHost) return requestOrigin
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"
  return `${forwardedProto}://${forwardedHost}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const redirect = searchParams.get("redirect") || "/dashboard"
  const origin = resolveOrigin(request)

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Нэвтрэх код олдсонгүй")}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
  }

  return NextResponse.redirect(`${origin}${redirect}`)
}
