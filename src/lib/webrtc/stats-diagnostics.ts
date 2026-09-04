// Peer camera-stats оношлогооны цэвэр логик (useWebRTCCamera.ts-ийн getStats()
// polling-оос тусгаарлагдсан) — RTCPeerConnection/browser орчингүйгээр unit
// test-ээр бүрэн баталгаажуулж болно. ЗӨВХӨН ВРЕМЕННО production evidence-
// gathering зорилготой, WebRTC логикт (capture/bitrate/ICE/signaling) огт
// нөлөөлдөггүй — зөвхөн ажиглалтын тоо тооцоолол.

export interface DiagnosticSample {
  ts: number
  outboundRtpId?: string
  bytesSent: number
  framesEncoded: number
  inboundRtpId?: string
  bytesReceived: number
  framesDecoded: number
  freezeCount: number
}

export interface DiagnosticDeltas {
  sendKbps?: number
  sendFps?: number
  recvKbps?: number
  recvFps?: number
  freezeDelta?: number
}

// getStats() report-оос гаргаж авсан нэг stat entry — browser-specific
// талбаруудыг Record<string, unknown>-ээр зөвшөөрнө (RTCStats-тай бүтцийн хувьд
// нийцтэй, гэхдээ энэ файл DOM lib-ээс хамааралгүй байхын тулд тусад нь зарлав).
export interface StatLike {
  type: string
  id?: string
  [key: string]: unknown
}

// Хуучин (prev) snapshot нь ӨӨР RTCPeerConnection instance-аас (pc rebuild)
// эсвэл ӨӨР RTP stream-ээс (SSRC/renegotiation-аар stat id өөрчлөгдсөн) ирсэн
// эсэхийг шалгаж, тухайн чиглэлийн (outbound/inbound тус тусад нь) delta
// тооцоолохгүй ("?" буюу undefined) — сөрөг тоо хэзээ ч гарахгүй. Мөн
// cumulative тоолуур ӨӨРӨӨ ухарсан бол (жишээ нь ижил RTP id-тай ч гэсэн
// backward утга — практикт тохиолдохгүй ч аюулгүй байдлын үүднээс) мөн адил
// "?"-ээр тэмдэглэнэ, тухайн нэг метрик л шинэ baseline-аас эхэлнэ.
//
// Дуудагч тал (useWebRTCCamera.ts) prev-г WeakMap<RTCPeerConnection,
// DiagnosticSample>-ээр хадгална — pc солигдмогц (rebuild) WeakMap дээрх key
// өөрчлөгдөх тул prev автоматаар undefined (шинэ baseline) болно, гар аргаар
// цэвэрлэх шаардлагагүй.
export function computeDiagnosticDeltas(
  prev: DiagnosticSample | undefined,
  curr: DiagnosticSample,
): DiagnosticDeltas {
  if (!prev) return {}

  const dt = (curr.ts - prev.ts) / 1000
  if (dt <= 0) return {}

  const outboundContinuous = !!prev.outboundRtpId && prev.outboundRtpId === curr.outboundRtpId
  const inboundContinuous = !!prev.inboundRtpId && prev.inboundRtpId === curr.inboundRtpId

  const result: DiagnosticDeltas = {}

  if (outboundContinuous) {
    const rawKbps = ((curr.bytesSent - prev.bytesSent) * 8) / dt / 1000
    if (rawKbps >= 0) result.sendKbps = Math.round(rawKbps)
    const rawFps = (curr.framesEncoded - prev.framesEncoded) / dt
    if (rawFps >= 0) result.sendFps = Math.round(rawFps)
  }

  if (inboundContinuous) {
    const rawKbps = ((curr.bytesReceived - prev.bytesReceived) * 8) / dt / 1000
    if (rawKbps >= 0) result.recvKbps = Math.round(rawKbps)
    const rawFps = (curr.framesDecoded - prev.framesDecoded) / dt
    if (rawFps >= 0) result.recvFps = Math.round(rawFps)
    const rawFreeze = curr.freezeCount - prev.freezeCount
    if (rawFreeze >= 0) result.freezeDelta = rawFreeze
  }

  return result
}

// Яг одоо мэдээ дамжуулж буй candidate-pair-г нэг утгагүйгээр тодорхойлно.
// Орчин үеийн transport.selectedCandidatePairId-г эхэлж хайна — байхгүй бол
// (хуучин browser) "nominated+succeeded" heuristic рүү буцна. Энэ heuristic
// дан ганцаараа найдваргүй: ICE restart-ийн үед хуучин (аль хэдийн дэвсэн)
// pair мөн адил nominated+succeeded хэвээр тайлагдаж болзошгүй тул алийг нь
// эхлээд олно тэрнийг сонгоно — заавал идэвхтэй pair байх баталгаагүй.
export function findSelectedCandidatePairId(stats: StatLike[]): string | undefined {
  const transport = stats.find(
    (s) => s.type === "transport" && typeof s.selectedCandidatePairId === "string",
  )
  if (transport) return transport.selectedCandidatePairId as string

  const pair = stats.find(
    (s) => s.type === "candidate-pair" && s.state === "succeeded" && s.nominated === true,
  )
  return pair?.id
}
