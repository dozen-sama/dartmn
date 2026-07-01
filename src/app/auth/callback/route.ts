import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const redirect = searchParams.get("redirect") || "/dashboard"
  const origin = new URL(request.url).origin

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
