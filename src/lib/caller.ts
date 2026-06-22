// Дартсны дуут "caller" — turn бүрийн оноо, checkout үлдэгдэл, 180/хожлыг
// чанга хэлнэ (Russ Bray маягийн). Web Speech API (speechSynthesis) ашиглана:
// instant, офлайн, үнэгүй, бичлэг шаардлагагүй.
//
// Voice сонголт: mn-MN → ru-RU → default. Ихэнх төхөөрөмжид mn voice байхгүй
// тул орос voice монгол кириллийг фонетикоор уншина (тиймээс тоог ҮГЭЭР бичнэ).
//
// Цаашид чанар хүрэхгүй бол speak()-ийг хүний бичлэгийн clip-ээр сольж болно —
// дуудах талбарууд (announceTurn) өөрчлөгдөхгүй.

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

// Voice-ууд async ачаалагддаг тул mount дээр нэг удаа дуудаж кэшлэнэ.
export function initCallerVoices() {
  if (!callerSupported()) return
  const refresh = () => { cachedVoice = pickVoice() }
  refresh()
  if (cachedVoice == null) window.speechSynthesis.onvoiceschanged = refresh
}

// ── Монгол тооны үг (0–180) ──
// Орос/монгол voice фонетикоор уншихад цифр биш үг хэрэгтэй.
const ONES = ["тэг", "нэг", "хоёр", "гурав", "дөрөв", "тав", "зургаа", "долоо", "найм", "ес"]
// Аравтын тоо: дангаараа (төгсгөлд) vs залгах (-н, ард нь үг дагах үед)
const TENS_ALONE: Record<number, string> = { 1: "арав", 2: "хорь", 3: "гуч", 4: "дөч", 5: "тавь", 6: "жар", 7: "дал", 8: "ная", 9: "ер" }
const TENS_COMB: Record<number, string> = { 1: "арван", 2: "хорин", 3: "гучин", 4: "дөчин", 5: "тавин", 6: "жаран", 7: "далан", 8: "наян", 9: "ерэн" }

export function mnNumber(n: number): string {
  if (n <= 0) return "тэг"
  const parts: string[] = []
  const h = Math.floor(n / 100)   // n ≤ 180 тул h нь 0 эсвэл 1
  const rem = n % 100
  if (h === 1) parts.push(rem === 0 ? "зуу" : "зуун")
  const t = Math.floor(rem / 10)
  const u = rem % 10
  if (t > 0) parts.push(h > 0 || u > 0 ? TENS_COMB[t] : TENS_ALONE[t])
  if (u > 0) parts.push(ONES[u])
  return parts.join(" ")
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
  synth.cancel()        // өмнөх дуудлагыг таслаж, шинэ turn-д шилжинэ
  synth.speak(u)
}

export type CallOutcome = "score" | "bust" | "checkout"

export interface CallArgs {
  points: number          // шидсэн тоглогчийн тухайн visit-д авсан нийт оноо
  outcome: CallOutcome
  nextRemaining: number   // ДАРААГИЙН (одоо ээлж нь болсон) тоглогчийн үлдэгдэл
}

// Turn-ийг дуудах: эхлээд шидсэн (өрсөлдөгч) хүний авсан оноог хэлж, дараа нь
// ээлж нь болсон тоглогчийн үлдэгдлийг (checkout хүрээнд) "Таны оноо N-аас" гэнэ.
// 180 ба хожлыг тусгай зарлана.
export function announceTurn({ points, outcome, nextRemaining }: CallArgs) {
  if (outcome === "checkout") { speak("Чек аут. Хожлоо!"); return }

  let text = outcome === "bust"
    ? "Хэтэрлээ"
    : (points === 180 ? "Зуун ная, максимум!" : mnNumber(points))

  // Дараагийн тоглогч checkout хүрээнд (≤170) бол түүний үлдэгдлийг сануулна
  if (nextRemaining > 1 && nextRemaining <= 170) {
    text += `. Таны оноо ${mnNumber(nextRemaining)} аас`
  }
  speak(text)
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
