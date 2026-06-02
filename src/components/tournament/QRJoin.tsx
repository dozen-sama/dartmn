"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Eye, EyeOff, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface QRJoinProps {
  tournamentId: string
  joinCode: string | null
  isOrganizer: boolean
  isRegistered: boolean
}

export function QRJoin({ tournamentId, joinCode, isOrganizer, isRegistered }: QRJoinProps) {
  const [showQR, setShowQR] = useState(false)

  if (!isOrganizer && !isRegistered) return null

  const joinUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/tournaments/${tournamentId}?join=1`

  function copyUrl() {
    navigator.clipboard.writeText(joinUrl)
    toast.success("Холбоос хуулагдлаа")
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowQR(!showQR)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <QrCode className="h-4 w-4" />
        QR кодоор нэгдэх
        {showQR ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>

      {showQR && (
        <div className="flex flex-col sm:flex-row items-start gap-4 p-4 rounded-xl border border-border/50 bg-secondary/20">
          {/* QR code */}
          <div className="bg-white p-3 rounded-xl shrink-0">
            <QRCodeSVG
              value={joinUrl}
              size={140}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Info */}
          <div className="space-y-3 flex-1 min-w-0">
            <div>
              <p className="text-sm font-semibold">QR уншуулж нэгдэх</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Камераар уншуулахад тэмцээний хуудас нээгдэнэ
              </p>
            </div>

            {joinCode && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Join Code</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-black tracking-widest text-primary">
                    {joinCode}
                  </span>
                  <button onClick={() => { navigator.clipboard.writeText(joinCode); toast.success("Code хуулагдлаа") }}
                    className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <button onClick={copyUrl}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
              <Copy className="h-3 w-3" />
              Холбоос хуулах
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
