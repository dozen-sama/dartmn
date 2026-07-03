"use client"

import { useState } from "react"
import { ArrowLeft, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Solo501 } from "./modes/Solo501"
import { CheckoutDrill } from "./modes/CheckoutDrill"
import { ScoringDrill } from "./modes/ScoringDrill"
import { AroundTheBoard } from "./modes/AroundTheBoard"
import { Bobs27 } from "./modes/Bobs27"
import { Checkout121 } from "./modes/Checkout121"
import { CricketPractice } from "./modes/CricketPractice"
import { Shanghai } from "./modes/Shanghai"
import { PracticeProgressDashboard } from "./progress/PracticeProgressDashboard"

type Mode = "menu" | "501" | "checkout" | "scoring" | "around" | "bobs27" | "checkout121" | "cricket" | "shanghai" | "progress"

export function PracticeHub() {
  const [mode, setMode] = useState<Mode>("menu")
  const onBack = () => setMode("menu")

  if (mode === "menu") return <ModeSelector onSelect={setMode} />
  if (mode === "501") return <Solo501 onBack={onBack} />
  if (mode === "checkout") return <CheckoutDrill onBack={onBack} />
  if (mode === "scoring") return <ScoringDrill onBack={onBack} />
  if (mode === "around") return <AroundTheBoard onBack={onBack} />
  if (mode === "bobs27") return <Bobs27 onBack={onBack} />
  if (mode === "checkout121") return <Checkout121 onBack={onBack} />
  if (mode === "cricket") return <CricketPractice onBack={onBack} />
  if (mode === "shanghai") return <Shanghai onBack={onBack} />
  if (mode === "progress") return <PracticeProgressDashboard onBack={onBack} />
  return null
}

// ── Mode selector ──────────────────────────────────────────────────
function ModeSelector({ onSelect }: { onSelect: (m: Mode) => void }) {
  const modes = [
    { key: "501" as Mode, icon: "🎯", title: "501 ганцаарчилсан", desc: "Ганцаараа 501 тоглож дундаж оноогоо шалга" },
    { key: "checkout" as Mode, icon: "✅", title: "Checkout Drill", desc: "Random checkout тоог дадлага хий" },
    { key: "scoring" as Mode, icon: "💯", title: "Scoring Drill", desc: "Багц суманд хамгийн өндөр оноо авах" },
    { key: "around" as Mode, icon: "🔄", title: "Around the Board", desc: "1-20 болон Bull-д дараалан оно (S/D/T)" },
    { key: "bobs27" as Mode, icon: "㉗", title: "Bob's 27", desc: "1-20 + Bull-ийн double-үүдийг дараалан оноол" },
    { key: "checkout121" as Mode, icon: "🎯", title: "121 Checkout", desc: "121-ээс эхлээд дараалсан checkout-уудыг хаа" },
    { key: "cricket" as Mode, icon: "🏏", title: "Cricket Practice", desc: "20-15 болон Bull-г хамгийн хурдан хаа" },
    { key: "shanghai" as Mode, icon: "🀄", title: "Shanghai", desc: "Round бүрт S+D+T нэг дор оносон бол шууд ялна" },
    { key: "progress" as Mode, icon: "📈", title: "Миний дэвшил", desc: "Хувийн streak, personal best, session түүх" },
  ]

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/play" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Бэлтгэл тоглолт
          </h1>
          <p className="text-muted-foreground text-sm">Ганцаараа дадлага хийх</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modes.map((m) => (
          <button key={m.key} onClick={() => onSelect(m.key)}
            className="flex items-start gap-4 p-4 rounded-xl border-2 border-border/50 bg-card/80 hover:border-primary/40 hover:bg-primary/5 transition-all text-left card-hover">
            <span className="text-3xl shrink-0">{m.icon}</span>
            <div>
              <p className="font-bold text-sm">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
