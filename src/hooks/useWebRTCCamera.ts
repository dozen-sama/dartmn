"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

export function useWebRTCCamera(supabase: SupabaseClient, roomId: string, myId: string) {
  const [cameraOn, setCameraOn] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [cameraError, setCameraError] = useState<string | null>(null)

  const localRef = useRef<MediaStream | null>(null)
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const myIdRef = useRef(myId)
  myIdRef.current = myId

  const toggleCamera = useCallback(async () => {
    if (localRef.current) {
      localRef.current.getTracks().forEach((t) => t.stop())
      localRef.current = null
      setLocalStream(null)
      setCameraOn(false)
      setCameraError(null)
      pcsRef.current.forEach((pc) => pc.close())
      pcsRef.current.clear()
      setRemoteStreams(new Map())
      channelRef.current?.send({
        type: "broadcast", event: "cam-off",
        payload: { from: myIdRef.current },
      })
    } else {
      setCameraError(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
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
  }, [])

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
      localRef.current?.getTracks().forEach((t) => t.stop())
      pcsRef.current.forEach((pc) => pc.close())
    }
  }, [])

  return { cameraOn, localStream, remoteStreams, toggleCamera, cameraError }
}
