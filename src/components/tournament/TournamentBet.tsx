"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Banknote, Lock, Copy } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils/format"

interface Props {
  tournamentId: string
  entryFee: number
  currentUserId: string
  registered: boolean
  canRegister: boolean
  currentUserName: string | null
  password: string | null
  organizer: {
    bank_name: string | null
    iban: string | null
    account_number: string | null
    account_holder: string | null
  }
  onRegistered: () => void
}

export function TournamentBet({
  tournamentId, entryFee, currentUserId, registered, canRegister, currentUserName, password, organizer, onRegistered,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pw, setPw] = useState("")
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountHolder, setAccountHolder] = useState("")
  const [iban, setIban] = useState("")

  async function register() {
    if (password && pw !== password) return toast.error("Нууц үг буруу байна")
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      return toast.error("Шагнал авах банкны мэдээллээ бүрэн оруулна уу")
    }
    setLoading(true)
    const supabase = createClient()
    const { error: rErr } = await supabase.from("tournament_registrations")
      .insert({ tournament_id: tournamentId, player_id: currentUserId, payment_status: "pending" })
    if (rErr) { setLoading(false); return toast.error("Бүртгэхэд алдаа гарлаа") }
    // Оролцогчийн шагнал авах данс (нууц — зөвхөн өөрөө + зохион байгуулагч)
    await supabase.from("tournament_payout_accounts").upsert({
      tournament_id: tournamentId, player_id: currentUserId,
      bank_name: bankName.trim(), account_number: accountNumber.trim(),
      account_holder: accountHolder.trim(), iban: iban.trim() || null,
    }, { onConflict: "tournament_id,player_id" })
    setLoading(false)
    setOpen(false)
    toast.success("Амжилттай бүртгүүллээ! Бооцоогоо шилжүүлнэ үү.")
    onRegistered()
  }

  // ── Бүртгүүлсэн → бооцоо өгөх (зохион байгуулагчийн данс) ──
  if (registered) {
    const note = currentUserName ?? "өөрийн нэр"
    return (
      <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Бооцоо өгөх — {formatCurrency(entryFee)}</p>
        </div>
        {organizer.account_number ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5 text-sm">
            <Row label="Банк" value={organizer.bank_name} />
            <Row label="Дансны дугаар" value={organizer.account_number} copy />
            <Row label="Эзэмшигч" value={organizer.account_holder} />
            {organizer.iban && <Row label="IBAN" value={organizer.iban} copy />}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Зохион байгуулагч дансны мэдээлэл оруулаагүй байна.</p>
        )}
        <div className="rounded-md bg-[oklch(0.78_0.16_85)]/10 border border-[oklch(0.78_0.16_85)]/30 px-3 py-2">
          <p className="text-xs text-[oklch(0.78_0.16_85)]">
            ⚠️ Гүйлгээний утга дээр <strong>«{note}»</strong> гэж заавал бичээд бооцоогоо дээрх дансанд шилжүүлнэ үү.
            Платформ мөнгөнд оролцдоггүй — маргаан гарвал зохион байгуулагчтай шийдвэрлэнэ.
          </p>
        </div>
      </div>
    )
  }

  if (!canRegister) return null

  // ── Бүртгэл (шагнал авах данс заавал) ──
  return (
    <div className="mt-4 pt-4 border-t border-border/50">
      {!open ? (
        <Button onClick={() => setOpen(true)} className="glow-primary w-full sm:w-auto">
          <Banknote className="h-4 w-4 mr-1.5" />
          Бүртгүүлэх ({formatCurrency(entryFee)})
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Шагнал хожвол энэ дансаар тань руу шилжүүлнэ. Мэдээллийг зөвхөн та болон зохион байгуулагч харна.
          </p>
          {password && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" />Тэмцээний нууц үг</Label>
              <Input value={pw} onChange={(e) => setPw(e.target.value)} type="password" className="bg-secondary/50 border-border/60" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Банкны нэр *</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Хаан банк" className="bg-secondary/50 border-border/60" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Дансны дугаар *</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="5xxxxxxxxx" className="bg-secondary/50 border-border/60" />
            </div>
            <div className="space-y-1.5">
              <Label>IBAN</Label>
              <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="MN__________" className="bg-secondary/50 border-border/60" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Данс эзэмшигчийн овог нэр *</Label>
            <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Овог Нэр" className="bg-secondary/50 border-border/60" />
          </div>
          <div className="flex gap-2">
            <Button onClick={register} disabled={loading} className="glow-primary">
              {loading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Бүртгүүлэх
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Болих</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, copy }: { label: string; value: string | null; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-medium flex items-center gap-1.5">
        {value ?? "—"}
        {copy && value && (
          <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success("Хуулагдлаа") }}
            className="text-muted-foreground hover:text-foreground">
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </div>
  )
}
