"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Зөвхөн admin dashboard-д нэвтрэх эрхийг шийдэх — club_admin энд хамаагүй
const ROLE_OPTIONS = [
  { value: "player", label: "Энгийн хэрэглэгч" },
  { value: "admin", label: "Админ" },
]

interface Props {
  userId: string
  role: string
  /** Өөрийн мөр — эрхээ өөрчлөхөөс сэргийлж идэвхгүй болгоно */
  isSelf?: boolean
}

export function UserRoleSelect({ userId, role, isSelf }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(role)
  const [saving, setSaving] = useState(false)

  async function change(next: string) {
    if (next === value || saving) return
    const prev = value
    setValue(next)
    setSaving(true)

    const res = await fetch("/api/admin/users/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role: next }),
    })

    if (res.ok) {
      toast.success("Эрх шинэчлэгдлээ")
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "Алдаа гарлаа")
      setValue(prev)
    }
    setSaving(false)
  }

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">Админ (та)</span>
  }

  return (
    <Select value={value} onValueChange={(v) => v && change(v)} disabled={saving}>
      <SelectTrigger size="sm" className="bg-secondary/50 border-border/60 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
