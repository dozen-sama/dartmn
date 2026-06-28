"use client"

import { useState } from "react"
import { Plus, X, ChevronUp, ChevronDown, AlertCircle, ArrowRight } from "lucide-react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  StageType,
  StageConfig,
  GameFormat,
  GameRules,
  GroupStageConfig,
  EliminationStageConfig,
  RoundRobinStageConfig,
  SwissStageConfig,
  SemiFinalStageConfig,
  FinalStageConfig,
  DEFAULT_CONFIGS,
  STAGE_LABELS,
  STAGE_ICONS,
  calculatePlayerFlow,
  validatePipeline,
} from "@/lib/tournament/stage-types"

export interface LocalStage {
  _id: string
  stage_type: StageType
  config: StageConfig
}

let _idCounter = 0
function genId() { return `s${++_idCounter}` }

// ── Mini Stepper ──────────────────────────────────────────────────────────────
function Stepper({
  value, onChange, min = 1, max = 99, label,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <Label className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</Label>}
      <div className="flex items-center">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="h-7 w-7 border border-border/60 rounded-l-md flex items-center justify-center hover:bg-secondary transition-colors text-sm">−</button>
        <input type="number" value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
          className="h-7 w-10 text-center text-sm font-bold border-y border-border/60 bg-secondary/50 focus:outline-none" />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="h-7 w-7 border border-border/60 rounded-r-md flex items-center justify-center hover:bg-secondary transition-colors text-sm">+</button>
      </div>
    </div>
  )
}

// ── Mini CheckRow ─────────────────────────────────────────────────────────────
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded accent-primary" />
      <span className="text-xs">{label}</span>
    </label>
  )
}

// ── Game rules editor (шат бүрт) ──────────────────────────────────────────────
function GameRulesEditor({ config, onChange }: {
  config: GameRules
  onChange: (patch: Partial<GameRules>) => void
}) {
  return (
    <div className="space-y-2 pt-2 mt-2 border-t border-border/30">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Тоглолтын тохиргоо</p>

      {/* Format */}
      <div className="flex gap-1.5">
        {(["501", "301", "170"] as GameFormat[]).map((f) => (
          <button key={f} type="button"
            onClick={() => onChange({ format: f, start_score: f === "170" ? 170 : f === "301" ? 301 : 501 })}
            className={cn("px-3 py-1 rounded-md border-2 text-sm font-bold transition-all",
              config.format === f
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/40 text-muted-foreground hover:border-border")}>
            {f}
          </button>
        ))}
      </div>

      {/* Double Out / In / Loser First */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        <CheckRow label="Захаар гарах" checked={config.double_out} onChange={(v) => onChange({ double_out: v })} />
        <CheckRow label="Double In" checked={config.double_in} onChange={(v) => onChange({ double_in: v })} />
        <CheckRow label="Loser First" checked={config.loser_first} onChange={(v) => onChange({ loser_first: v })} />
      </div>

      {/* Limit rounds */}
      <div className="flex flex-wrap items-center gap-3">
        <CheckRow
          label="Сумны хязгаар"
          checked={config.limit_rounds !== null}
          onChange={(v) => onChange({ limit_rounds: v ? 15 : null, bull_finish_at_limit: false })}
        />
        {config.limit_rounds !== null && (
          <>
            <Stepper value={config.limit_rounds} onChange={(v) => onChange({ limit_rounds: v })} min={5} max={99} label="Visit" />
            <div className="mt-4">
              <CheckRow label="Bull-д дуусгах" checked={config.bull_finish_at_limit} onChange={(v) => onChange({ bull_finish_at_limit: v })} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Stage-specific structural config ──────────────────────────────────────────
function StageStructureEditor({ stageType, config, onChange }: {
  stageType: StageType
  config: StageConfig
  onChange: (patch: Partial<StageConfig>) => void
}) {
  if (stageType === "group") {
    const c = config as GroupStageConfig
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <Stepper value={c.groups_count} onChange={(v) => onChange({ groups_count: v })} min={2} max={16} label="Бүлгийн тоо" />
          <Stepper value={c.players_per_group} onChange={(v) => onChange({ players_per_group: v })} min={2} max={20} label="Бүлгийн хүн" />
          <Stepper
            value={c.advance_count}
            onChange={(v) => onChange({ advance_count: Math.min(v, c.players_per_group - 1) })}
            min={1} max={Math.max(1, c.players_per_group - 1)} label="Гарах тоо" />
          <Stepper value={c.rr_first_to} onChange={(v) => onChange({ rr_first_to: v })} min={1} max={11} label="1st to" />
        </div>
        <div className="flex items-center gap-3">
          <CheckRow label="Тэнцэл зөвшөөрөх" checked={c.enable_draw} onChange={(v) => onChange({ enable_draw: v })} />
          <span className="text-[11px] text-primary/80 font-medium">
            = {c.groups_count * c.players_per_group} нийт · {c.groups_count * c.advance_count} дэвших
          </span>
        </div>
      </div>
    )
  }

  if (stageType === "elimination") {
    const c = config as EliminationStageConfig
    const modeLabel = c.max_losses === 1 ? "Single" : c.max_losses === 2 ? "Double" : `×${c.max_losses}`
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <Stepper value={c.max_losses} onChange={(v) => onChange({ max_losses: v })} min={1} max={5} label="Хасагдах алдаа" />
          <Stepper value={c.first_to} onChange={(v) => onChange({ first_to: v })} min={1} max={11} label="1st to" />
          {c.sets_enabled && (
            <Stepper value={c.legs_per_set} onChange={(v) => onChange({ legs_per_set: v })} min={1} max={11} label="Legs/set" />
          )}
          <div className="self-end pb-1">
            <span className="text-[11px] font-semibold text-primary">{modeLabel} Elimination</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <CheckRow label="Sets" checked={c.sets_enabled} onChange={(v) => onChange({ sets_enabled: v })} />
          <CheckRow label="3-р байрны тоглолт" checked={c.has_third_place} onChange={(v) => onChange({ has_third_place: v })} />
        </div>
      </div>
    )
  }

  if (stageType === "round_robin") {
    const c = config as RoundRobinStageConfig
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <Stepper value={c.first_to} onChange={(v) => onChange({ first_to: v })} min={1} max={11} label="1st to" />
          {c.sets_enabled && (
            <Stepper value={c.legs_per_set} onChange={(v) => onChange({ legs_per_set: v })} min={1} max={11} label="Legs/set" />
          )}
          <Stepper value={c.advance_count} onChange={(v) => onChange({ advance_count: v })} min={0} max={128} label="Дэвших тоо" />
        </div>
        <div className="flex flex-wrap gap-3">
          <CheckRow label="Sets" checked={c.sets_enabled} onChange={(v) => onChange({ sets_enabled: v })} />
          <CheckRow label="Тэнцэл зөвшөөрөх" checked={c.enable_draw} onChange={(v) => onChange({ enable_draw: v })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Stepper value={c.point_won} onChange={(v) => onChange({ point_won: v })} min={0} max={10} label="Хожил" />
          <Stepper value={c.point_draw} onChange={(v) => onChange({ point_draw: v })} min={0} max={10} label="Тэнцэл" />
          <Stepper value={c.point_lost} onChange={(v) => onChange({ point_lost: v })} min={0} max={10} label="Хохирол" />
        </div>
      </div>
    )
  }

  if (stageType === "swiss") {
    const c = config as SwissStageConfig
    return (
      <div className="flex flex-wrap gap-3">
        <Stepper value={c.rounds_count} onChange={(v) => onChange({ rounds_count: v })} min={2} max={20} label="Тойргийн тоо" />
        <Stepper value={c.first_to} onChange={(v) => onChange({ first_to: v })} min={1} max={11} label="1st to" />
        <Stepper value={c.advance_count} onChange={(v) => onChange({ advance_count: v })} min={0} max={128} label="Дэвших тоо" />
      </div>
    )
  }

  if (stageType === "semifinal") {
    const c = config as SemiFinalStageConfig
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <Stepper value={c.first_to} onChange={(v) => onChange({ first_to: v })} min={1} max={11} label="1st to" />
          {c.sets_enabled && (
            <Stepper value={c.legs_per_set} onChange={(v) => onChange({ legs_per_set: v })} min={1} max={11} label="Legs/set" />
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <CheckRow label="Sets" checked={c.sets_enabled} onChange={(v) => onChange({ sets_enabled: v })} />
          <CheckRow label="3-р байрны тоглолт" checked={c.has_third_place} onChange={(v) => onChange({ has_third_place: v })} />
        </div>
        <p className="text-[11px] text-muted-foreground">4 тоглогч → 2 хагас финал → финал{c.has_third_place ? " + 3-р байр" : ""}</p>
      </div>
    )
  }

  if (stageType === "final") {
    const c = config as FinalStageConfig
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-3">
          <Stepper value={c.first_to} onChange={(v) => onChange({ first_to: v })} min={1} max={11} label="1st to" />
          {c.sets_enabled && (
            <Stepper value={c.legs_per_set} onChange={(v) => onChange({ legs_per_set: v })} min={1} max={11} label="Legs/set" />
          )}
        </div>
        <CheckRow label="Sets" checked={c.sets_enabled} onChange={(v) => onChange({ sets_enabled: v })} />
        <p className="text-[11px] text-muted-foreground">2 тоглогч → 1 тоглолт → аварга</p>
      </div>
    )
  }

  return null
}

// ── Stage type picker ─────────────────────────────────────────────────────────
const STAGE_TYPES: StageType[] = ["group", "elimination", "round_robin", "swiss", "semifinal", "final"]

function StageTypePicker({ onPick, onClose }: { onPick: (t: StageType) => void; onClose: () => void }) {
  return (
    <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-border/60 rounded-xl shadow-xl overflow-y-auto max-h-72 overscroll-contain"
      onWheel={(e) => e.stopPropagation()}>
      {STAGE_TYPES.map((t) => (
        <button key={t} type="button"
          onClick={() => { onPick(t); onClose() }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors text-left">
          <span className="text-lg">{STAGE_ICONS[t]}</span>
          <span className="text-sm font-medium">{STAGE_LABELS[t]}</span>
        </button>
      ))}
    </div>
  )
}

// ── Main StageBuilder ─────────────────────────────────────────────────────────
interface Props {
  stages: LocalStage[]
  onChange: (stages: LocalStage[]) => void
  initialPlayers: number
}

export function StageBuilder({ stages, onChange, initialPlayers }: Props) {
  const [showPicker, setShowPicker] = useState(false)

  const flow = calculatePlayerFlow(stages, initialPlayers)
  const errors = validatePipeline(stages, initialPlayers)

  function addStage(type: StageType) {
    onChange([...stages, { _id: genId(), stage_type: type, config: { ...DEFAULT_CONFIGS[type] } }])
  }

  function removeStage(idx: number) {
    onChange(stages.filter((_, i) => i !== idx))
  }

  function moveStage(idx: number, dir: -1 | 1) {
    const next = [...stages]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }

  function updateConfig(idx: number, patch: Partial<StageConfig>) {
    onChange(stages.map((s, i) => i !== idx ? s : { ...s, config: { ...s.config, ...patch } }))
  }

  const globalErrors = errors.filter((e) => e.stageIndex === -1)

  return (
    <div className="space-y-2">
      {/* Pipeline flow preview */}
      {stages.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground px-1">
          <span className="font-semibold text-foreground">{initialPlayers}</span>
          {flow.map((f, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ArrowRight className="h-3 w-3 text-border" />
              <span>{STAGE_ICONS[f.stageType]}</span>
              {f.playersOut > 0
                ? <span className="font-semibold text-foreground">{f.playersOut}</span>
                : <span className="font-semibold text-primary">🏆</span>
              }
            </span>
          ))}
        </div>
      )}

      {/* Global errors */}
      {globalErrors.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {e.message}
        </div>
      ))}

      {/* Stage cards */}
      {stages.map((s, idx) => {
        const stageErrors = errors.filter((e) => e.stageIndex === idx)
        const f = flow[idx]
        return (
          <div key={s._id} className={cn(
            "rounded-xl border bg-secondary/20 p-3 space-y-2 transition-colors",
            stageErrors.length > 0 ? "border-destructive/40" : "border-border/50"
          )}>
            {/* Card header */}
            <div className="flex items-center gap-2">
              <span className="text-lg select-none">{STAGE_ICONS[s.stage_type]}</span>
              <span className="text-sm font-semibold flex-1">{STAGE_LABELS[s.stage_type]}</span>
              {f && (
                <span className="text-[11px] text-muted-foreground mr-1">
                  {f.playersIn} → {f.playersOut > 0 ? `${f.playersOut} дэвших` : "🏆 финал"}
                </span>
              )}
              <div className="flex gap-0.5">
                <button type="button" onClick={() => moveStage(idx, -1)} disabled={idx === 0}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary disabled:opacity-30 transition-colors">
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1}
                  className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary disabled:opacity-30 transition-colors">
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={() => removeStage(idx)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Structural config (first_to, groups_count, etc.) */}
            <StageStructureEditor
              stageType={s.stage_type}
              config={s.config}
              onChange={(patch) => updateConfig(idx, patch)}
            />

            {/* Game rules (format, double_out, limit_rounds, etc.) */}
            <GameRulesEditor
              config={s.config as GameRules}
              onChange={(patch) => updateConfig(idx, patch)}
            />

            {/* Inline errors */}
            {stageErrors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {e.message}
              </div>
            ))}

            {/* Flow description */}
            {f && (
              <p className="text-[11px] text-muted-foreground">{f.description} · ~{f.matchCount} тоглолт</p>
            )}
          </div>
        )
      })}

      {/* Add stage */}
      <div className="relative">
        <button type="button" onClick={() => setShowPicker(!showPicker)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-dashed border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all">
          <Plus className="h-4 w-4" />
          Шат нэмэх
        </button>
        {showPicker && (
          <StageTypePicker onPick={addStage} onClose={() => setShowPicker(false)} />
        )}
      </div>
    </div>
  )
}
