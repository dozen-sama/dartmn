"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Save, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const ROLE_OPTIONS = [
  { value: "player", label: "Энгийн хэрэглэгч" },
  { value: "admin", label: "Админ" },
]

interface Props {
  userId: string
  initial: { display_name: string; username: string; phone: string; role: string }
  isSelf?: boolean
}

export function UserEditForm({ userId, initial, isSelf }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [displayName, setDisplayName] = useState(initial.display_name)
  const [username, setUsername] = useState(initial.username)
  const [phone, setPhone] = useState(initial.phone)
  const [role, setRole] = useState(initial.role)
  const [password, setPassword] = useState("")

  async function handleSave() {
    if (!displayName.trim()) return toast.error("Дэлгэцийн нэр оруулна уу")
    if (password && password.length < 6) return toast.error("Нууц үг дор хаяж 6 тэмдэгт")

    setSaving(true)
    const res = await fetch("/api/admin/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        display_name: displayName,
        username,
        phone,
        role: isSelf ? undefined : role,
        password: password || undefined,
      }),
    })

    if (res.ok) {
      toast.success("Хадгалагдлаа")
      setPassword("")
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Алдаа гарлаа")
    }
    setSaving(false)
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3"><CardTitle className="text-sm">Үндсэн мэдээлэл</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Дэлгэцийн нэр</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-secondary/50 border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Хэрэглэгчийн нэр</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  className="bg-secondary/50 border-border/60 pl-7" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Утас</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="99xxxxxx" className="bg-secondary/50 border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Эрх (dashboard)</Label>
              {isSelf ? (
                <p className="text-sm text-muted-foreground py-2">Админ (та) — өөрчлөх боломжгүй</p>
              ) : (
                <Select value={role} onValueChange={(v) => v && setRole(v)}>
                  <SelectTrigger className="bg-secondary/50 border-border/60 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-400" />
            Нууц үг сэргээх
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Label className="text-sm">Шинэ нууц үг</Label>
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Хоосон бол өөрчлөхгүй" className="bg-secondary/50 border-border/60" />
          <p className="text-[11px] text-muted-foreground">Дор хаяж 6 тэмдэгт. Бөглөвөл л солигдоно.</p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full glow-primary" size="lg" disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Хадгалах
      </Button>
    </div>
  )
}
