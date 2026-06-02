"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"

export function RegisterForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (!form.email) return toast.error(mn.auth.emailRequired)
    if (!form.password || form.password.length < 6) return toast.error(mn.auth.passwordMinLength)
    if (form.password !== form.confirmPassword) return toast.error(mn.auth.passwordMismatch)
    if (!form.username) return toast.error(mn.auth.usernameRequired)

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          username: form.username.toLowerCase(),
          display_name: form.displayName || form.username,
        },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success(mn.auth.registerSuccess)
    router.push("/dashboard")
    router.refresh()
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
              <Label className="text-sm">Хэрэглэгчийн нэр</Label>
              <Input
                placeholder="dartmaster"
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                className="bg-secondary/50 border-border/60"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Дэлгэцийн нэр</Label>
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
              onChange={(e) => update("email", e.target.value)}
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
