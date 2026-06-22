// Дартсны дуут "caller" — turn бүрийн оноо, checkout үлдэгдэл, 180/хожлыг
// чанга хэлнэ (Russ Bray маягийн).
//
// Хоёр горим:
//  1) Хүний дуу бичлэг (админ upload хийсэн) — бүх шаардлагатай key-д бичлэг
//     байвал тэдгээрийг дараалан тоглуулна (caller_clips + caller-voice bucket).
//  2) Web Speech API (TTS) — бичлэг дутуу бол fallback. Voice: mn→ru→default.

import { createClient } from "@/lib/supabase/client"

// ── TTS (fallback) ──
let cachedVoice: SpeechSynthesisVoice | null | undefined = undefined

export function callerSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!callerSupported()) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const byLang = (p: string) => voices.find((v) => v.lang.toLowerCase().startsWith(p))
  return byLang("mn") ?? byLang("ru") ?? voices.find((v) => v.default) ?? voices[0] ?? null
}

export function initCallerVoices() {
  if (!callerSupported()) return
  const refresh = () => { cachedVoice = pickVoice() }
  refresh()
  if (cachedVoice == null) window.speechSynthesis.onvoiceschanged = refresh
}

export function speak(text: string) {
  if (!callerSupported()) return
  const synth = window.speechSynthesis
  if (cachedVoice === undefined) cachedVoice = pickVoice()
  const u = new SpeechSynthesisUtterance(text)
  if (cachedVoice) { u.voice = cachedVoice; u.lang = cachedVoice.lang }
  u.rate = 1.0
  u.pitch = 1.0
  u.volume = 1
  synth.cancel()
  synth.speak(u)
}

// ── Монгол тооны үг (0–180) ──
const ONES = ["тэг", "нэг", "хоёр", "гурав", "дөрөв", "тав", "зургаа", "долоо", "найм", "ес"]
const TENS_ALONE: Record<number, string> = { 1: "арав", 2: "хорь", 3: "гуч", 4: "дөч", 5: "тавь", 6: "жар", 7: "дал", 8: "ная", 9: "ер" }
const TENS_COMB: Record<number, string> = { 1: "арван", 2: "хорин", 3: "гучин", 4: "дөчин", 5: "тавин", 6: "жаран", 7: "далан", 8: "наян", 9: "ерэн" }

export function mnNumber(n: number): string {
  if (n <= 0) return "тэг"
  const parts: string[] = []
  const h = Math.floor(n / 100)
  const rem = n % 100
  if (h === 1) parts.push(rem === 0 ? "зуу" : "зуун")
  const t = Math.floor(rem / 10)
  const u = rem % 10
  if (t > 0) parts.push(h > 0 || u > 0 ? TENS_COMB[t] : TENS_ALONE[t])
  if (u > 0) parts.push(ONES[u])
  return parts.join(" ")
}

// ── Caller-ийн бүх key (админ бичлэг хийх жагсаалт) ──
// Фраз key-үүд + тоо ("1".."180").
export const PHRASE_LABELS: Record<string, string> = {
  p_taniy_onoo: "Таны оноо",
  p_aas: "аас",
  p_maximum: "Максимум!",
  p_checkout: "Чек аут. Хожлоо!",
  p_bust: "Хэтэрлээ",
}

export interface CallerKey { key: string; label: string; group: "phrase" | "number" }

export function callerKeys(): CallerKey[] {
  const phrases: CallerKey[] = Object.entries(PHRASE_LABELS).map(([key, label]) => ({ key, label, group: "phrase" }))
  const numbers: CallerKey[] = []
  for (let n = 1; n <= 180; n++) numbers.push({ key: String(n), label: mnNumber(n), group: "number" })
  return [...phrases, ...numbers]
}

// ── Хүний бичлэгийн manifest (caller_clips) ──
const CLIP_BUCKET = "caller-voice"
let clipMap: Map<string, string> | null = null
let clipLoading: Promise<void> | null = null

export function loadCallerClips(): Promise<void> {
  if (clipMap) return Promise.resolve()
  if (clipLoading) return clipLoading
  clipLoading = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase: any = createClient()
      const { data } = await supabase.from("caller_clips").select("key, ext, updated_at")
      const store = supabase.storage.from(CLIP_BUCKET)
      const m = new Map<string, string>()
      for (const row of (data ?? []) as { key: string; ext: string; updated_at: string }[]) {
        const base = store.getPublicUrl(`${row.key}.${row.ext}`).data.publicUrl
        m.set(row.key, `${base}?v=${new Date(row.updated_at).getTime()}`)
      }
      clipMap = m
    } catch {
      clipMap = new Map()
    }
  })()
  return clipLoading
}

export function hasClips(): boolean { return !!clipMap && clipMap.size > 0 }
function clipUrl(key: string): string | undefined { return clipMap?.get(key) }

// ── Дуудлагын дараалал (clip key-үүд) + TTS текст ──
export type CallOutcome = "score" | "bust" | "checkout"

export interface CallArgs {
  points: number          // шидсэн тоглогчийн visit-ийн нийт оноо
  outcome: CallOutcome
  nextRemaining: number   // ДАРААГИЙН (одоо ээлж нь болсон) тоглогчийн үлдэгдэл
}

function clipKeysFor({ points, outcome, nextRemaining }: CallArgs): string[] {
  if (outcome === "checkout") return ["p_checkout"]
  const seq: string[] = []
  if (outcome === "bust") seq.push("p_bust")
  else if (points === 180) seq.push("180", "p_maximum")
  else if (points > 0) seq.push(String(points))
  if (nextRemaining > 1 && nextRemaining <= 170) seq.push("p_taniy_onoo", String(nextRemaining), "p_aas")
  return seq
}

function ttsTextFor({ points, outcome, nextRemaining }: CallArgs): string {
  if (outcome === "checkout") return "Чек аут. Хожлоо!"
  let text = outcome === "bust" ? "Хэтэрлээ" : (points === 180 ? "Зуун ная, максимум!" : mnNumber(points))
  if (nextRemaining > 1 && nextRemaining <= 170) text += `. Таны оноо ${mnNumber(nextRemaining)} аас`
  return text
}

// ── Аудио клип дараалан тоглуулагч ──
let audioEl: HTMLAudioElement | null = null
let playToken = 0

function stopAudio() { if (audioEl) { audioEl.pause(); audioEl.onended = null; audioEl.onerror = null } }

function playClips(urls: string[]) {
  if (typeof window === "undefined") return
  playToken += 1
  const token = playToken
  if (!audioEl) audioEl = new Audio()
  let i = 0
  const next = () => {
    if (token !== playToken) return            // шинэ дуудлагад дарагдсан
    if (i >= urls.length) return
    const el = audioEl!
    el.src = urls[i++]
    el.onended = next
    el.onerror = next
    el.play().catch(() => {})
  }
  next()
}

// Turn-ийг зарлах: бичлэгтэй бол хүний дуугаар, үгүй бол TTS.
export function announceTurn(args: CallArgs) {
  const keys = clipKeysFor(args)
  if (keys.length > 0 && hasClips() && keys.every((k) => clipUrl(k))) {
    if (callerSupported()) window.speechSynthesis.cancel()
    playClips(keys.map((k) => clipUrl(k)!))
    return
  }
  stopAudio()
  speak(ttsTextFor(args))
}

// ── Асаалт/унтраалт (төхөөрөмж тус бүр, localStorage) ──
const STORAGE_KEY = "darts-caller-enabled"

export function getCallerEnabled(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(STORAGE_KEY) !== "0"   // default: ON
}

export function setCallerEnabled(on: boolean) {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, on ? "1" : "0")
}
