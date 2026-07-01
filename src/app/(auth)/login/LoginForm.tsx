"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/dashboard"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    const oauthError = searchParams.get("error")
    if (oauthError) toast.error(oauthError)
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return toast.error(mn.auth.emailRequired)
    if (!password) return toast.error(mn.auth.passwordRequired)

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setUnconfirmed(true)
        toast.error(mn.auth.emailNotConfirmed)
      } else {
        setUnconfirmed(false)
        toast.error(mn.auth.invalidCredentials)
      }
      return
    }
    setUnconfirmed(false)

    toast.success(mn.auth.loginSuccess)
    router.push(redirectTo)
    router.refresh()
  }

  async function handleResendConfirmation() {
    if (!email) return toast.error(mn.auth.emailRequired)
    setResendLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({ type: "signup", email })
    setResendLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(mn.auth.resendConfirmationSent)
    }
  }

  async function handleOAuth(provider: "google") {
    setOauthLoading(provider)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirectTo}` },
      })
      if (error) {
        setOauthLoading(null)
        toast.error(error.message)
      }
    } catch (e) {
      setOauthLoading(null)
      toast.error(e instanceof Error ? e.message : "Google-ээр нэвтрэхэд алдаа гарлаа")
    }
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">{mn.auth.login}</CardTitle>
        <CardDescription>Дартс тоглолтоо үргэлжлүүлэх</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* OAuth */}
        <Button
          type="button"
          variant="outline"
          className="w-full border-border/60 hover:bg-secondary"
          onClick={() => handleOAuth("google")}
          disabled={!!oauthLoading}
        >
          {oauthLoading === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Google-ээр нэвтрэх
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">{mn.auth.orContinueWith}</span>
          <Separator className="flex-1" />
        </div>

        {/* Email form */}
        <form onSubmit={handleLogin} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">{mn.auth.email}</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary/50 border-border/60"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm">{mn.auth.password}</Label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                {mn.auth.forgotPassword}
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-secondary/50 border-border/60 pr-9"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full glow-primary" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mn.auth.login}
          </Button>

          {unconfirmed && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400">
              <p className="mb-2">{mn.auth.emailNotConfirmed}</p>
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendLoading}
                className="flex items-center gap-1.5 text-xs font-medium underline underline-offset-2 hover:text-yellow-300 disabled:opacity-50"
              >
                {resendLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                {mn.auth.resendConfirmation}
              </button>
            </div>
          )}
        </form>
      </CardContent>

      <CardFooter className="justify-center pt-0">
        <p className="text-sm text-muted-foreground">
          {mn.auth.noAccount}{" "}
          <Link href="/register" className="text-primary font-medium hover:underline">
            {mn.auth.register}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
