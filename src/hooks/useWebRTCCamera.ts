"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { GOOGLE_STUN_FALLBACK, isValidIceServers } from "@/lib/webrtc/ice-servers"
import { resolveIncomingOffer } from "@/lib/webrtc/offer-collision"
import {
  shouldInitiateRecovery,
  shouldAttemptIceRestart,
  shouldRebuildAfterRecoveryTimeout,
  canAttemptRebuild,
} from "@/lib/webrtc/ice-recovery"
import {
  computeDiagnosticDeltas,
  findSelectedCandidatePairId,
  type DiagnosticSample,
  type StatLike,
} from "@/lib/webrtc/stats-diagnostics"

// "disconnected" төлөв энэ хугацаанд арилаагүй хэвээр байвал л ICE-restart
// эхлүүлнэ (богино тасалдал өөрөө засардаг тул шууд бус, түр хүлээнэ).
const ICE_DISCONNECTED_GRACE_MS = 3000
// ICE-restart offer илгээснээс хойш энэ хугацаанд connected/completed
// болоогүй бол peer connection-г бүрмөсөн шинээр босгоно (bounded, endless
// retry биш).
const ICE_RECOVERY_TIMEOUT_MS = 8000

// Camera/WebRTC session бүрд НЭГ Л удаа дуудагдана (off→on шилжилтэд).
// Cloudflare-с TURN+STUN авахыг оролдоод, амжилтгүй бол (timeout, network,
// 401/403/503, буруу бүтэцтэй/хоосон payload гэх мэт) чимээгүй Google
// STUN-only руу буцна — алдаа хэзээ ч throw хийхгүй тул дуудагч тал үргэлж
// ашиглах боломжтой массив авна.
async function fetchIceServers(roomId: string): Promise<RTCIceServer[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`/api/play/room/${roomId}/turn-credentials`, {
      method: "POST", signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error("turn-credentials request failed")
    const data = await res.json()
    if (!isValidIceServers(data?.iceServers)) throw new Error("invalid iceServers shape")
    return data.iceServers
  } catch {
    // Sanitized log — Cloudflare алдаа/response/credential хэзээ ч энд ирдэггүй
    console.warn("[camera] TURN credential боломжгүй — Google STUN-only fallback ашиглаж байна")
    return GOOGLE_STUN_FALLBACK
  }
}

// Ар болон урд камерыг зэрэг нээхэд ихэнх утас нэг физик камер л зэрэг
// нээхийг зөвшөөрдөг тул хоёр stream-ийг WebRTC-д тусдаа track болгож
// явуулах боломжгүй (client бүрд нэг л video track ирнэ гэж тооцоологдсон).
// Тиймээс хоёр камерыг offscreen canvas дээр нэг frame болгон нэгтгээд
// (том нь ар тал, жижиг нь урд тал) canvas.captureStream()-ээр ганц track
// болгож явуулна — хүлээн авагч талд ямар ч өөрчлөлт хийх шаардлагагүй.
function composeDualStream(rear: MediaStream, front: MediaStream): { stream: MediaStream; cleanup: () => void } {
  const rearVideo = document.createElement("video")
  rearVideo.srcObject = rear
  rearVideo.muted = true
  rearVideo.playsInline = true
  rearVideo.play().catch(() => {})

  const frontVideo = document.createElement("video")
  frontVideo.srcObject = front
  frontVideo.muted = true
  frontVideo.playsInline = true
  frontVideo.play().catch(() => {})

  const canvas = document.createElement("canvas")
  canvas.width = 640
  canvas.height = 480
  const ctx = canvas.getContext("2d")!

  let rafId = 0
  const draw = () => {
    if (rearVideo.readyState >= 2) ctx.drawImage(rearVideo, 0, 0, canvas.width, canvas.height)
    if (frontVideo.readyState >= 2) {
      // Жижиг сэлфи inset — баруун доод булан, толин тусгалтай (сэлфи мэт харагдана)
      const iw = canvas.width * 0.32
      const ih = canvas.height * 0.32
      const ix = canvas.width - iw - 10
      const iy = canvas.height - ih - 10
      ctx.save()
      ctx.translate(ix + iw, iy)
      ctx.scale(-1, 1)
      ctx.drawImage(frontVideo, 0, 0, iw, ih)
      ctx.restore()
      ctx.strokeStyle = "rgba(255,255,255,0.6)"
      ctx.lineWidth = 2
      ctx.strokeRect(ix, iy, iw, ih)
    }
    rafId = requestAnimationFrame(draw)
  }
  draw()

  const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(24)

  const cleanup = () => {
    cancelAnimationFrame(rafId)
    rear.getTracks().forEach((t) => t.stop())
    front.getTracks().forEach((t) => t.stop())
    rearVideo.srcObject = null
    frontVideo.srcObject = null
  }

  return { stream, cleanup }
}

export function useWebRTCCamera(supabase: SupabaseClient, roomId: string, myId: string) {
  const [cameraOn, setCameraOn] = useState(false)
  const [dualCamera, setDualCamera] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [iceStates, setIceStates] = useState<Map<string, RTCIceConnectionState>>(new Map())

  const localRef = useRef<MediaStream | null>(null)
  const dualCleanupRef = useRef<(() => void) | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  // Peer тус бүрийн ICE-сэргээлтийн timer-үүд (grace + bounded recovery
  // timeout) — хоёул зэрэг идэвхтэй байж болохгүй, доорх recovery-логик үүнийг
  // хангана. rebuildCountRef нь тухайн episode-д хэдэн удаа pc бүрмөсөн
  // шинээр босгосныг хадгална (canAttemptRebuild-ээр 1-ээр хязгаарлана).
  // inFlight: сэргээх шийдвэр гарсан мөчөөс (grace/failed) bounded timeout
  // дуустал синхроноор true байна — attemptIceRestart-ийн createOffer/
  // setLocalDescription хараахан дуусаагүй байхад ижил peer-д хоёр дахь
  // restart санамсаргүй эхлэхээс сэргийлнэ (timeout handle бүртгэгдэхийг
  // хүлээхгүйгээр шууд шалгах боломжтой).
  const recoveryTimersRef = useRef<
    Map<
      string,
      { grace?: ReturnType<typeof setTimeout>; timeout?: ReturnType<typeof setTimeout>; inFlight?: boolean }
    >
  >(new Map())
  const rebuildCountRef = useRef<Map<string, number>>(new Map())

  // Тухайн peer-ийн бүх ICE-сэргээлтийн timer/төлвийг цэвэрлэнэ — cam-off,
  // stopCamera, эсвэл hook unmount үед orphaned timer үлдэхээс сэргийлнэ.
  const clearRecoveryState = useCallback((remoteId: string) => {
    const t = recoveryTimersRef.current.get(remoteId)
    if (t?.grace) clearTimeout(t.grace)
    if (t?.timeout) clearTimeout(t.timeout)
    recoveryTimersRef.current.delete(remoteId)
    rebuildCountRef.current.delete(remoteId)
  }, [])
  // Энэ session-д (камер off→on-оос дараагийн бүрмөсөн унтрах хүртэл) ашиглах
  // ICE server жагсаалт — нэг л удаа fetchIceServers()-ээр тогтооно.
  const iceServersRef = useRef<RTCIceServer[]>(GOOGLE_STUN_FALLBACK)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const myIdRef = useRef(myId)
  myIdRef.current = myId
  const facingRef = useRef<"environment" | "user">("environment")

  // Идэвхтэй камерыг бүрмөсөн унтраах — single болон dual горим хоёуланд адил ашиглана.
  const stopCamera = useCallback((broadcastOff: boolean) => {
    dualCleanupRef.current?.()
    dualCleanupRef.current = null
    localRef.current?.getTracks().forEach((t) => t.stop())
    localRef.current = null
    setLocalStream(null)
    setCameraOn(false)
    setDualCamera(false)
    setCameraError(null)
    pcsRef.current.forEach((pc) => pc.close())
    Array.from(recoveryTimersRef.current.keys()).forEach(clearRecoveryState)
    pcsRef.current.clear()
    setRemoteStreams(new Map())
    setIceStates(new Map())
    if (broadcastOff) {
      channelRef.current?.send({
        type: "broadcast", event: "cam-off",
        payload: { from: myIdRef.current },
      })
    }
  }, [clearRecoveryState])

  const toggleCamera = useCallback(async () => {
    if (localRef.current) {
      stopCamera(true)
    } else {
      setCameraError(null)
      try {
        const [stream, iceServers] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: facingRef.current } },
            audio: false,
          }),
          fetchIceServers(roomId),
        ])
        iceServersRef.current = iceServers
        localRef.current = stream
        setLocalStream(stream)
        setCameraOn(true)
        channelRef.current?.send({
          type: "broadcast", event: "cam-on",
          payload: { from: myIdRef.current },
        })
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[camera] toggle-camera error:", (err as DOMException)?.name)
        }
        setCameraError("Камер нэвтэрч чадсангүй. Зөвшөөрөл шалгана уу.")
      }
    }
  }, [stopCamera, roomId])

  // Ар/урд камер сэлгэх — идэвхтэй peer холболтууд дээрх video track-г
  // шинэ камерынхаар сольж, дахин offer/answer солилцохгүйгээр үргэлжлүүлнэ.
  const flipCamera = useCallback(async () => {
    if (!localRef.current || dualCleanupRef.current) return
    const nextFacing = facingRef.current === "environment" ? "user" : "environment"
    // Ихэнх гар утасны камер driver нэг физик камерт зэрэг нэг л reader
    // зөвшөөрдөг тул шинэ камерыг нээхээсээ ӨМНӨ хуучныг заавал бүрмөсөн
    // зогсоох ёстой — эсрэгээр (шинийг нээгээд дараа нь хуучныг зогсоох)
    // хийвэл зарим Android/iOS дээр камер хараахан чөлөөлөгдөөгүй байхад
    // хоёр дахь нээх хүсэлт NotReadableError-тай бүтэлгүйтдэг.
    localRef.current.getTracks().forEach((t) => t.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      })
      const newTrack = stream.getVideoTracks()[0]
      localRef.current = stream
      facingRef.current = nextFacing
      setLocalStream(stream)

      // Локал камер аль хэдийн шинэчлэгдсэн (localStream шинэ камерыг харуулж
      // байгаа) тул үүнийг цуцлахгүй — гэхдээ аль нэг peer рүү шинэ track-г
      // дамжуулж чадаагүй бол (sender.replaceTrack reject) тухайн холболтыг
      // "амьд" мэт үлдээж болохгүй: амжилтгүй болсон sender нь зогссон хуучин
      // track-аа хэвээр агуулна ("frozen" видео нөгөө талд харагдана) —
      // тиймээс амжилтгүй болсон peer connection-г эвдэрсэн гэж үзэж хааж,
      // remote төлвөөс хасаад, хэрэглэгчид алдаа харуулна.
      const entries = Array.from(pcsRef.current.entries())
      const results = await Promise.allSettled(
        entries.map(([, pc]) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video")
          return sender ? sender.replaceTrack(newTrack) : Promise.resolve()
        }),
      )
      const failedPeerIds = entries.filter((_, i) => results[i].status === "rejected").map(([id]) => id)
      if (failedPeerIds.length > 0) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[camera] flip-camera replaceTrack failed for peer count:", failedPeerIds.length)
        }
        failedPeerIds.forEach((remoteId) => {
          pcsRef.current.get(remoteId)?.close()
          pcsRef.current.delete(remoteId)
          setRemoteStreams((prev) => {
            const next = new Map(prev)
            next.delete(remoteId)
            return next
          })
          setIceStates((prev) => {
            const next = new Map(prev)
            next.delete(remoteId)
            return next
          })
        })
        setCameraError("Камер солигдлоо, гэхдээ зарим тоглогчид дамжуулахад алдаа гарлаа.")
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[camera] flip-camera error:", (err as DOMException)?.name)
      }
      // Хуучин камерыг аль хэдийн зогсоосон тул хагас төлөвт үлдэхгүйн тулд
      // бүрмөсөн унтраагаад алдаагаа харуулна.
      stopCamera(true)
      setCameraError("Камер солиход алдаа гарлаа.")
    }
  }, [stopCamera])

  // Ар, урд хоёр камерыг зэрэг нээх — ихэнх утас нэг л физик камер тус
  // бүрийг зэрэг нээхийг зөвшөөрдөг тул хоёуланг нь нэг canvas frame-д
  // нэгтгэж ганц track болгон явуулна. Төхөөрөмж дэмжихгүй бол алдаа
  // харуулаад хуучин төлвөө хэвээр үлдээнэ.
  const toggleDualCamera = useCallback(async () => {
    if (dualCleanupRef.current) {
      stopCamera(true)
      return
    }

    setCameraError(null)
    // Promise.all ашиглавал НЭГ нь rejected болмогц нөгөө нь аль хэдийн
    // амжилттай нээгдсэн байсан ч мэдэгдэхгүй, тухайн track "далд" ажиллаж
    // үлдэнэ (жинхэнэ leak). Тиймээс allSettled ашиглаж хоёуланг нь үргэлж
    // шалгаад, амжилттай нээгдсэн ч гэсэн нөгөө нь бүтэлгүйтвэл шууд зогсооно.
    const [rearResult, frontResult] = await Promise.allSettled([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "user" } }, audio: false }),
    ])

    if (rearResult.status === "rejected" || frontResult.status === "rejected") {
      if (rearResult.status === "fulfilled") rearResult.value.getTracks().forEach((t) => t.stop())
      if (frontResult.status === "fulfilled") frontResult.value.getTracks().forEach((t) => t.stop())
      if (process.env.NODE_ENV !== "production") {
        const names = [
          rearResult.status === "rejected" ? (rearResult.reason as DOMException)?.name : null,
          frontResult.status === "rejected" ? (frontResult.reason as DOMException)?.name : null,
        ].filter(Boolean)
        console.warn("[camera] toggle-dual-camera error:", names.join(", "))
      }
      setCameraError("Энэ төхөөрөмж дээр хоёр камерыг зэрэг ажиллуулах боломжгүй байна.")
      return
    }

    const rear = rearResult.value
    const front = frontResult.value
    const { stream: composite, cleanup } = composeDualStream(rear, front)
    const newTrack = composite.getVideoTracks()[0]
    const wasOn = !!localRef.current
    // Шинэ session эхэлж байгаа тохиолдолд (өмнө камер бүрмөсөн унтарсан
    // байсан) л дахин mint хийнэ — session дундуур single↔dual сэлгэхэд
    // хуучин credential-аа дахин ашиглана.
    if (!wasOn) iceServersRef.current = await fetchIceServers(roomId)

    localRef.current?.getTracks().forEach((t) => t.stop())
    dualCleanupRef.current = cleanup
    localRef.current = composite
    setLocalStream(composite)
    setCameraOn(true)
    setDualCamera(true)

    if (wasOn) {
      pcsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video")
        sender?.replaceTrack(newTrack).catch(() => {})
      })
    } else {
      channelRef.current?.send({
        type: "broadcast", event: "cam-on",
        payload: { from: myIdRef.current },
      })
    }
  }, [stopCamera, roomId])

  useEffect(() => {
    function createPc(remoteId: string): RTCPeerConnection {
      const existing = pcsRef.current.get(remoteId)
      if (existing && existing.signalingState !== "closed") return existing

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState
        setIceStates((prev) => {
          const next = new Map(prev)
          next.set(remoteId, state)
          return next
        })
        handleIceStateChange(remoteId, pc, state)
      }

      pc.ontrack = ({ streams }) => {
        const stream = streams[0]
        if (!stream) return
        setRemoteStreams((prev) => {
          const next = new Map(prev)
          next.set(remoteId, stream)
          return next
        })
      }

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && channelRef.current) {
          channelRef.current.send({
            type: "broadcast", event: "ice",
            payload: { from: myIdRef.current, to: remoteId, c: candidate.toJSON() },
          })
        }
      }

      pcsRef.current.set(remoteId, pc)
      return pc
    }

    function addLocalTracks(pc: RTCPeerConnection) {
      if (!localRef.current) return
      if (pc.getSenders().some((s) => s.track !== null)) return
      localRef.current.getTracks().forEach((t) => pc.addTrack(t, localRef.current!))
    }

    // Wi-Fi↔cellular шилжилт эсвэл түр тасалдал зэргээс болж ICE холболт
    // тасрахад камерын stream-д огт хүрэлгүйгээр тухайн НЭГ peer connection-г
    // сэргээхийг оролдоно. Шийдвэрийг зөвхөн ice-recovery.ts-ийн цэвэр
    // функцууд гаргана — энд зөвхөн timer/RTCPeerConnection wiring.
    function handleIceStateChange(remoteId: string, pc: RTCPeerConnection, state: RTCIceConnectionState) {
      // Хуучин (аль хэдийн rebuild-ээр сольсон/хаасан) pc-ийн хоцорсон event
      // бол юу ч хийхгүй — шинэ pc-ийн recovery төлвийг санамсаргүй
      // цэвэрлэх/дарахаас сэргийлнэ.
      if (pcsRef.current.get(remoteId) !== pc) return

      const isInitiator = shouldInitiateRecovery(myIdRef.current, remoteId)
      const timers = recoveryTimersRef.current.get(remoteId) ?? {}

      if (state === "connected" || state === "completed") {
        if (timers.grace) clearTimeout(timers.grace)
        if (timers.timeout) clearTimeout(timers.timeout)
        recoveryTimersRef.current.delete(remoteId)
        rebuildCountRef.current.set(remoteId, 0) // амжилттай сэргэсэн тул дараагийн эвдрэл шинэ episode
        return
      }

      if (state === "closed") {
        clearRecoveryState(remoteId)
        return
      }

      if (state === "checking" || state === "new") return // бие даан сэргээлт эхлүүлэхгүй

      if (state === "failed") {
        // "failed" эцсийн байдал тул хүлээгдэж буй grace timer-г цуцлаад
        // шууд шийднэ — гэхдээ аль хэдийн restart/rebuild хүлээж байвал
        // (inFlight) шинээр давхардуулахгүй.
        if (timers.grace) { clearTimeout(timers.grace); timers.grace = undefined }
        if (!timers.inFlight && shouldAttemptIceRestart(state, isInitiator)) {
          timers.inFlight = true
          recoveryTimersRef.current.set(remoteId, timers)
          void attemptIceRestart(remoteId, pc)
        }
        return
      }

      if (state === "disconnected") {
        if (timers.grace || timers.inFlight) return // аль хэдийн сэргээлтийн мөчлөгт байна
        const graceTimer = setTimeout(() => {
          if (pcsRef.current.get(remoteId) !== pc) return // stale — timer map-д хүрэхгүй
          const current = recoveryTimersRef.current.get(remoteId)
          if (!current) return
          current.grace = undefined
          if (!current.inFlight && shouldAttemptIceRestart(pc.iceConnectionState, isInitiator)) {
            current.inFlight = true
            recoveryTimersRef.current.set(remoteId, current)
            void attemptIceRestart(remoteId, pc)
          } else {
            recoveryTimersRef.current.set(remoteId, current)
          }
        }, ICE_DISCONNECTED_GRACE_MS)
        recoveryTimersRef.current.set(remoteId, { ...timers, grace: graceTimer })
      }
    }

    // inFlight флаг нь энд эхэлж, timeoutTimer шатах мөчид арилна — grace/
    // failed шийдвэр гараад createOffer/setLocalDescription хараахан
    // дуусаагүй хугацаанд ижил peer-д хоёр дахь restart санамсаргүй
    // давхцахаас (race) энэ хамгаална, timeout handle бүртгэгдэхийг
    // хүлээх шаардлагагүйгээр шууд шалгаж болно.
    async function attemptIceRestart(remoteId: string, pc: RTCPeerConnection) {
      if (pcsRef.current.get(remoteId) !== pc) return
      try {
        const offer = await pc.createOffer({ iceRestart: true })
        if (pcsRef.current.get(remoteId) !== pc) return
        await pc.setLocalDescription(offer)
        channelRef.current?.send({
          type: "broadcast", event: "offer",
          payload: { from: myIdRef.current, to: remoteId, sdp: pc.localDescription },
        })
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[camera] ice-restart-offer error:", (err as DOMException)?.name)
        }
      }

      // Restart offer амжилттай илгээгдсэн эсэхээс үл хамааран bounded
      // хугацаа тавина — амжилтгүй болсон ч дараа нь rebuild-руу унана.
      const timeoutTimer = setTimeout(() => {
        if (pcsRef.current.get(remoteId) !== pc) return // stale — timer map-д хүрэхгүй
        const current = recoveryTimersRef.current.get(remoteId)
        if (current) {
          current.timeout = undefined
          current.inFlight = false
          recoveryTimersRef.current.set(remoteId, current)
        }
        if (shouldRebuildAfterRecoveryTimeout(pc.iceConnectionState)) {
          rebuildPeerConnection(remoteId)
        }
      }, ICE_RECOVERY_TIMEOUT_MS)
      const current = recoveryTimersRef.current.get(remoteId) ?? {}
      recoveryTimersRef.current.set(remoteId, { ...current, timeout: timeoutTimer })
    }

    // ICE-restart bounded хугацаанд амжилтгүй болвол дуудагдана — тухайн ГАНЦ
    // peer connection-г бүрмөсөн хааж, шинээр босгоно. Камерын localRef-д
    // ХЭЗЭЭ Ч хүрэхгүй (getUserMedia дахин дуудахгүй) — идэвхтэй local
    // track-уудыг л шинэ pc рүү дахин холбоно. Нэг episode-д ганц удаа л
    // зөвшөөрөгдөнө (canAttemptRebuild) — endless rebuild loop-оос сэргийлнэ.
    function rebuildPeerConnection(remoteId: string) {
      const count = rebuildCountRef.current.get(remoteId) ?? 0
      if (!canAttemptRebuild(count)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[camera] ice-rebuild skipped — already attempted once this episode")
        }
        return
      }
      rebuildCountRef.current.set(remoteId, count + 1)

      pcsRef.current.get(remoteId)?.close()
      pcsRef.current.delete(remoteId)

      if (!localRef.current) return // камер энэ хооронд унтарсан бол сэргээх юмгүй

      const pc = createPc(remoteId)
      addLocalTracks(pc)
      pc.createOffer()
        .then((offer) => {
          if (pcsRef.current.get(remoteId) !== pc) return
          return pc.setLocalDescription(offer).then(() => {
            channelRef.current?.send({
              type: "broadcast", event: "offer",
              payload: { from: myIdRef.current, to: remoteId, sdp: pc.localDescription },
            })
          })
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[camera] ice-rebuild-offer error:", (err as DOMException)?.name)
          }
        })
    }

    const ch = supabase.channel(`cam-${roomId}`, {
      config: { broadcast: { self: false } },
    })
    channelRef.current = ch

    // Remote player turned camera on — if we have camera, offer to them
    ch.on("broadcast", { event: "cam-on" }, async ({ payload }) => {
      const from = payload?.from as string
      if (!from || !localRef.current) return
      try {
        const pc = createPc(from)
        addLocalTracks(pc)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        ch.send({
          type: "broadcast", event: "offer",
          payload: { from: myIdRef.current, to: from, sdp: pc.localDescription },
        })
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[camera] cam-on-offer error:", (err as DOMException)?.name)
        }
      }
    })

    // Received offer from a remote player. localRef.current шалгалт нь
    // cam-on handler-тай ижил — iceServersRef.current нь ЗААВАЛ localRef.current
    // тохируулагдсантай ЗЭРЭГ (toggleCamera/toggleDualCamera доторх синхрон
    // блокт) шинэчлэгддэг тул энэ шалгалт createPc()-г session-ий fetch
    // дуусаагүй байхад хэзээ ч дуудагдахгүй гэдгийг баталгаажуулна (race guard).
    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      const { from, to, sdp } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit }
      if (to !== myIdRef.current || !localRef.current) return
      try {
        const pc = createPc(from)
        // Хоёр тал бараг зэрэг камераа асаавал хоёулаа offer үүсгэх "glare"
        // тохиолдол гарч болно (createPc-г cam-on handler-т аль хэдийн дуудсан
        // тул pc "have-local-offer" төлөвт байна) — resolveIncomingOffer нь
        // энэ мөргөлдөөнийг id-гаар нь тодорхойлно (unit test-тэй, pure логик).
        const action = resolveIncomingOffer(pc.signalingState, myIdRef.current, from)
        if (action === "ignore") return
        if (action === "rollback-then-accept") await pc.setLocalDescription({ type: "rollback" })
        addLocalTracks(pc)
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        ch.send({
          type: "broadcast", event: "answer",
          payload: { from: myIdRef.current, to: from, sdp: pc.localDescription },
        })
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[camera] offer-negotiation error:", (err as DOMException)?.name)
        }
      }
    })

    // Received answer to our offer
    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      const { from, to, sdp } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit }
      if (to !== myIdRef.current) return
      const pc = pcsRef.current.get(from)
      if (pc && pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {})
      }
    })

    // ICE candidate
    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      const { from, to, c } = payload as { from: string; to: string; c: RTCIceCandidateInit }
      if (to !== myIdRef.current) return
      const pc = pcsRef.current.get(from)
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
    })

    // Remote player turned camera off
    ch.on("broadcast", { event: "cam-off" }, ({ payload }) => {
      const from = payload?.from as string
      if (!from) return
      pcsRef.current.get(from)?.close()
      pcsRef.current.delete(from)
      clearRecoveryState(from)
      setRemoteStreams((prev) => {
        const next = new Map(prev)
        next.delete(from)
        return next
      })
      setIceStates((prev) => {
        const next = new Map(prev)
        next.delete(from)
        return next
      })
    })

    ch.subscribe()

    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [roomId, supabase, clearRecoveryState])

  // ВРЕМЕННО (evidence-gathering, 2026-09-03): "локал preview зөв, гэхдээ
  // remote видео удаашрах/slow-motion болоод дараа нь catch-up хийдэг" гэсэн
  // production тайланг encode → transport/TURN → jitter buffer → decode
  // шатуудын алинд нь үүсэж байгааг тодорхойлохын тулд 3 секунд тутам
  // getStats()-ээр хэмжилт авч консольд бичнэ. Bitrate/constraints ЭНД
  // ХЭЗЭЭ Ч өөрчлөгдөхгүй — зөвхөн ажиглалт. Оношлогдмогц энэ блокийг хасна.
  useEffect(() => {
    // pc instance-аар key хийнэ — rebuildPeerConnection нь ижил remoteId дор
    // ШИНЭ RTCPeerConnection тавьдаг тул (SSRC/counter бүгд 0-ээс дахин
    // эхэлдэг), snapshot-г зөвхөн remoteId-аар хадгалбал шинэ pc-ийн анхны
    // sample хуучин pc-ийн хуримтлагдсан тоотой diff хийгдэж сөрөг утга гардаг
    // байсан. WeakMap<RTCPeerConnection, ...> ашигласнаар pc солигдмогц prev
    // автоматаар undefined (шинэ baseline) болно — гар аргаар цэвэрлэх
    // шаардлагагүй, хуучин pc GC-genд мөн чөлөөлөгдөнө.
    const snapshots = new WeakMap<RTCPeerConnection, DiagnosticSample>()

    const interval = setInterval(() => {
      pcsRef.current.forEach((pc, remoteId) => {
        if (pc.connectionState !== "connected" && pc.iceConnectionState !== "connected" && pc.iceConnectionState !== "completed") return
        pc.getStats().then((report) => {
          const stats: StatLike[] = []
          report.forEach((s) => stats.push(s as unknown as StatLike))

          let outboundRtpId: string | undefined
          let bytesSent = 0
          let framesEncoded = 0
          let qualityLimitationReason: string | undefined

          let inboundRtpId: string | undefined
          let bytesReceived = 0
          let framesDecoded = 0
          let packetsLost = 0
          let jitter: number | undefined
          let jitterBufferDelay = 0
          let jitterBufferEmittedCount = 0
          let freezeCount = 0
          let totalFreezesDuration = 0

          for (const stat of stats) {
            if (stat.type === "outbound-rtp" && stat.kind === "video") {
              outboundRtpId = stat.id
              bytesSent = (stat.bytesSent as number) ?? 0
              framesEncoded = (stat.framesEncoded as number) ?? 0
              qualityLimitationReason = stat.qualityLimitationReason as string | undefined
            }
            if (stat.type === "inbound-rtp" && stat.kind === "video") {
              inboundRtpId = stat.id
              bytesReceived = (stat.bytesReceived as number) ?? 0
              framesDecoded = (stat.framesDecoded as number) ?? 0
              packetsLost = (stat.packetsLost as number) ?? 0
              jitter = typeof stat.jitter === "number" ? Math.round((stat.jitter as number) * 1000) : undefined
              jitterBufferDelay = (stat.jitterBufferDelay as number) ?? 0
              jitterBufferEmittedCount = (stat.jitterBufferEmittedCount as number) ?? 0
              freezeCount = (stat.freezeCount as number) ?? 0
              totalFreezesDuration = (stat.totalFreezesDuration as number) ?? 0
            }
          }

          // Идэвхтэй candidate-pair-г transport.selectedCandidatePairId-аар
          // нэг утгагүй тодорхойлно (байхгүй бол nominated+succeeded fallback) —
          // "nominated+succeeded" ганцаараа олон pair-т нийцэж болзошгүй тул
          // ICE restart-ийн үед хуучирсан (идэвхгүй болсон ч хэвээр
          // nominated тэмдэглэгдсэн) pair-г санамсаргүй сонгож болдог байсан.
          let rtt: number | undefined
          let availOutKbps: number | undefined
          let localCandidateType: string | undefined
          let remoteCandidateType: string | undefined
          let protocol: string | undefined
          let relayProtocol: string | undefined

          const pairId = findSelectedCandidatePairId(stats)
          if (pairId) {
            const pair = stats.find((s) => s.type === "candidate-pair" && s.id === pairId)
            if (pair) {
              rtt = typeof pair.currentRoundTripTime === "number" ? Math.round((pair.currentRoundTripTime as number) * 1000) : undefined
              availOutKbps = typeof pair.availableOutgoingBitrate === "number" ? Math.round((pair.availableOutgoingBitrate as number) / 1000) : undefined

              // Сонгогдсон candidate-ийн ТЕГШИЛСЭН (address/port/candidate
              // string ХЭЗЭЭ Ч биш) төрлийг л уншина — зөвхөн candidateType/
              // protocol/relayProtocol, TURN сервер рүү хэрхэн хүрч байгааг
              // ойлгоход хангалттай.
              const localCandidateId = pair.localCandidateId as string | undefined
              const remoteCandidateId = pair.remoteCandidateId as string | undefined
              const local = stats.find((s) => s.type === "local-candidate" && s.id === localCandidateId)
              const remote = stats.find((s) => s.type === "remote-candidate" && s.id === remoteCandidateId)
              localCandidateType = local?.candidateType as string | undefined
              protocol = local?.protocol as string | undefined
              relayProtocol = local?.relayProtocol as string | undefined
              remoteCandidateType = remote?.candidateType as string | undefined
            }
          }

          const curr: DiagnosticSample = {
            ts: performance.now(),
            outboundRtpId, bytesSent, framesEncoded,
            inboundRtpId, bytesReceived, framesDecoded, freezeCount,
          }
          const deltas = computeDiagnosticDeltas(snapshots.get(pc), curr)
          snapshots.set(pc, curr)

          const avgJbufMs = jitterBufferEmittedCount > 0 ? Math.round((jitterBufferDelay / jitterBufferEmittedCount) * 1000) : undefined

          console.info(
            `[camera-stats] peer=${remoteId.slice(0, 8)} rtt=${rtt ?? "?"}ms ` +
            `out=${deltas.sendKbps ?? "?"}kbps/${deltas.sendFps ?? "?"}fps in=${deltas.recvKbps ?? "?"}kbps/${deltas.recvFps ?? "?"}fps ` +
            `jbuf=${avgJbufMs ?? "?"}ms jitter=${jitter ?? "?"}ms loss=${packetsLost} ` +
            `freeze=+${deltas.freezeDelta ?? "?"}(${Math.round(totalFreezesDuration * 1000)}ms total) ` +
            `qLimit=${qualityLimitationReason ?? "none"} availOut=${availOutKbps ?? "?"}kbps ` +
            `path=${localCandidateType ?? "?"}->${remoteCandidateType ?? "?"} proto=${protocol ?? "?"} relayProto=${relayProtocol ?? "-"}`,
          )
        }, () => {})
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    const pcs = pcsRef.current
    const recoveryTimers = recoveryTimersRef.current
    const rebuildCounts = rebuildCountRef.current
    return () => {
      dualCleanupRef.current?.()
      localRef.current?.getTracks().forEach((t) => t.stop())
      pcs.forEach((pc) => pc.close())
      recoveryTimers.forEach((t) => {
        if (t.grace) clearTimeout(t.grace)
        if (t.timeout) clearTimeout(t.timeout)
      })
      recoveryTimers.clear()
      rebuildCounts.clear()
    }
  }, [])

  return {
    cameraOn, dualCamera, localStream, remoteStreams,
    toggleCamera, flipCamera, toggleDualCamera, cameraError, iceStates,
  }
}
