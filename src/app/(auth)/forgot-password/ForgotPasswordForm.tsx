"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { mn } from "@/locales/mn"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return toast.error(mn.auth.emailRequired)

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?redirect=/reset-password`,
    })

    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }

    setSent(true)
    toast.success(mn.auth.resetLinkSent)
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl">{mn.auth.forgotPasswordTitle}</CardTitle>
        <CardDescription>{mn.auth.forgotPasswordDescription}</CardDescription>
      </CardHeader>

      <CardContent>
        {sent ? (
          <p className="text-center text-sm text-muted-foreground py-4">{mn.auth.resetLinkSent}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
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
            <Button type="submit" className="w-full glow-primary" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mn.auth.sendResetLink}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="justify-center pt-0">
        <Link href="/login" className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          {mn.auth.backToLogin}
        </Link>
      </CardFooter>
    </Card>
  )
}
