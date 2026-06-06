"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2, Mail, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"

export function RegisterForm() {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)
  const [existingUnconfirmed, setExistingUnconfirmed] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    displayName: "",
  })

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function getErrorMessage(msg: string): string {
    const m = msg.toLowerCase()
    if (m.includes("user already registered") || m.includes("already been registered"))
      return mn.auth.emailAlreadyRegistered
    if (m.includes("email not confirmed"))
      return mn.auth.emailNotConfirmed
    if (m.includes("password"))
      return mn.auth.passwordMinLength
    if (m.includes("invalid email"))
      return "Имэйл хаягийн формат буруу байна"
    if (m.includes("rate limit") || m.includes("too many"))
      return "Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдно уу."
    return "Алдаа гарлаа. Дахин оролдно уу."
  }

  async function handleResend() {
    setResendLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({ type: "signup", email: form.email })
    setResendLoading(false)
    if (error) {
      toast.error(getErrorMessage(error.message))
    } else {
      setExistingUnconfirmed(false)
      setDone(true)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (!form.email) return toast.error(mn.auth.emailRequired)
    if (!form.password || form.password.length < 6) return toast.error(mn.auth.passwordMinLength)
    if (form.password !== form.confirmPassword) return toast.error(mn.auth.passwordMismatch)
    if (!form.username) return toast.error(mn.auth.usernameRequired)

    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username.toLowerCase(),
          display_name: form.displayName || form.username,
        },
      },
    })

    setLoading(false)

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes("user already registered") || msg.includes("already been registered")) {
        setExistingUnconfirmed(true)
      } else {
        toast.error(getErrorMessage(error.message))
      }
      return
    }

    // Бүртгэлтэй боловч баталгаажаагүй — identities хоосон
    if (!data.user?.identities?.length) {
      setExistingUnconfirmed(true)
      return
    }

    setDone(true)
  }

  // Амжилттай бүртгүүлсний дараа "имэйл шалгах" дэлгэц
  if (done) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="text-lg font-semibold text-foreground">{mn.auth.checkEmailToConfirm}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {mn.auth.checkEmailDescription}
          </p>
          <p className="text-sm font-medium text-foreground">{form.email}</p>
          <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline mt-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            {mn.auth.backToLogin}
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">{mn.auth.register}</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleRegister} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">{mn.auth.username}</Label>
              <Input
                placeholder="dartmaster"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                className="bg-secondary/50 border-border/60"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">{mn.auth.displayName}</Label>
              <Input
                placeholder="Бат-Эрдэнэ"
                value={form.displayName}
                onChange={(e) => update("displayName", e.target.value)}
                className="bg-secondary/50 border-border/60"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{mn.auth.email}</Label>
            <Input
              type="email"
              placeholder="name@example.com"
              value={form.email}
              onChange={(e) => {
                update("email", e.target.value)
                setExistingUnconfirmed(false)
              }}
              className="bg-secondary/50 border-border/60"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">{mn.auth.password}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="bg-secondary/50 border-border/60 pr-9"
                autoComplete="new-password"
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

          <div className="space-y-1.5">
            <Label className="text-sm">{mn.auth.confirmPassword}</Label>
            <Input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              className="bg-secondary/50 border-border/60"
              autoComplete="new-password"
            />
          </div>

          {existingUnconfirmed && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-400 space-y-2">
              <p>{mn.auth.alreadyRegisteredUnconfirmed}</p>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="flex items-center gap-1.5 text-xs font-medium underline underline-offset-2 hover:text-yellow-300 disabled:opacity-50"
                >
                  {resendLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {mn.auth.resendConfirmation}
                </button>
                <span className="text-yellow-600">·</span>
                <Link href="/login" className="text-xs font-medium underline underline-offset-2 hover:text-yellow-300">
                  {mn.auth.goToLogin}
                </Link>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full mt-2 glow-primary" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mn.auth.register}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center pt-0">
        <p className="text-sm text-muted-foreground">
          {mn.auth.hasAccount}{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            {mn.auth.login}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
