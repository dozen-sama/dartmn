"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

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

  const localRef = useRef<MediaStream | null>(null)
  const dualCleanupRef = useRef<(() => void) | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
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
    pcsRef.current.clear()
    setRemoteStreams(new Map())
    if (broadcastOff) {
      channelRef.current?.send({
        type: "broadcast", event: "cam-off",
        payload: { from: myIdRef.current },
      })
    }
  }, [])

  const toggleCamera = useCallback(async () => {
    if (localRef.current) {
      stopCamera(true)
    } else {
      setCameraError(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingRef.current } },
          audio: false,
        })
        localRef.current = stream
        setLocalStream(stream)
        setCameraOn(true)
        channelRef.current?.send({
          type: "broadcast", event: "cam-on",
          payload: { from: myIdRef.current },
        })
      } catch {
        setCameraError("Камер нэвтэрч чадсангүй. Зөвшөөрөл шалгана уу.")
      }
    }
  }, [stopCamera])

  // Ар/урд камер сэлгэх — идэвхтэй peer холболтууд дээрх video track-г
  // шинэ камерынхаар сольж, дахин offer/answer солилцохгүйгээр үргэлжлүүлнэ.
  const flipCamera = useCallback(async () => {
    if (!localRef.current || dualCleanupRef.current) return
    const nextFacing = facingRef.current === "environment" ? "user" : "environment"
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
        audio: false,
      })
      const newTrack = stream.getVideoTracks()[0]
      localRef.current.getTracks().forEach((t) => t.stop())
      localRef.current = stream
      facingRef.current = nextFacing
      setLocalStream(stream)
      pcsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video")
        sender?.replaceTrack(newTrack).catch(() => {})
      })
    } catch {
      setCameraError("Камер солиход алдаа гарлаа.")
    }
  }, [])

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
    let rear: MediaStream
    let front: MediaStream
    try {
      ;[rear, front] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "user" } }, audio: false }),
      ])
    } catch {
      setCameraError("Энэ төхөөрөмж дээр хоёр камерыг зэрэг ажиллуулах боломжгүй байна.")
      return
    }

    const { stream: composite, cleanup } = composeDualStream(rear, front)
    const newTrack = composite.getVideoTracks()[0]
    const wasOn = !!localRef.current

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
  }, [stopCamera])

  useEffect(() => {
    function createPc(remoteId: string): RTCPeerConnection {
      const existing = pcsRef.current.get(remoteId)
      if (existing && existing.signalingState !== "closed") return existing

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

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

    const ch = supabase.channel(`cam-${roomId}`, {
      config: { broadcast: { self: false } },
    })
    channelRef.current = ch

    // Remote player turned camera on — if we have camera, offer to them
    ch.on("broadcast", { event: "cam-on" }, async ({ payload }) => {
      const from = payload?.from as string
      if (!from || !localRef.current) return
      const pc = createPc(from)
      addLocalTracks(pc)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      ch.send({
        type: "broadcast", event: "offer",
        payload: { from: myIdRef.current, to: from, sdp: pc.localDescription },
      })
    })

    // Received offer from a remote player
    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      const { from, to, sdp } = payload as { from: string; to: string; sdp: RTCSessionDescriptionInit }
      if (to !== myIdRef.current) return
      const pc = createPc(from)
      addLocalTracks(pc)
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      ch.send({
        type: "broadcast", event: "answer",
        payload: { from: myIdRef.current, to: from, sdp: pc.localDescription },
      })
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
      setRemoteStreams((prev) => {
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
  }, [roomId, supabase])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dualCleanupRef.current?.()
      localRef.current?.getTracks().forEach((t) => t.stop())
      pcsRef.current.forEach((pc) => pc.close())
    }
  }, [])

  return {
    cameraOn, dualCamera, localStream, remoteStreams,
    toggleCamera, flipCamera, toggleDualCamera, cameraError,
  }
}
