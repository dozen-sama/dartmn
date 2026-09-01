// TURN/STUN тохиргоо — useWebRTCCamera hook болон холбогдох тестүүдэд ашиглана.

// Cloudflare TURN унтарсан/алдаатай үед эргэн ашиглах — одоогийн production-ий
// STUN-only тохиргоо. Камер асаалт ЯМАР Ч тохиолдолд үүгээр блоклогдохгүй.
export const GOOGLE_STUN_FALLBACK: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

// HTTP 200 өөрөө хангалттай биш — Cloudflare (эсвэл ямар ч эх сурвалж) буруу
// бүтэцтэй payload буцаавал (urls талбар байхгүй/хоосон), шууд
// `new RTCPeerConnection({iceServers})`-д дамжуулбал constructor throw хийж,
// broadcast handler дотор барьцаагүй алдаа болно. Тиймээс ашиглахаас өмнө
// entry бүрийн бүтцийг баталгаажуулна.
export function isValidIceServers(value: unknown): value is RTCIceServer[] {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.every((entry) => {
    if (!entry || typeof entry !== "object") return false
    const urls = (entry as { urls?: unknown }).urls
    if (typeof urls === "string") return urls.length > 0
    if (Array.isArray(urls)) return urls.length > 0 && urls.every((u) => typeof u === "string" && u.length > 0)
    return false
  })
}
