"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Minus, PictureInPicture2, Plus, SwitchCamera, VideoOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useZoom } from "@/hooks/useZoom"

const COLLAPSE_MS = 3000

function Tile({
  stream, label, zoom,
}: {
  stream: MediaStream
  label?: string
  zoom?: number
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])

  return (
    <div className="relative flex-1 h-full overflow-hidden bg-zinc-900">
      <video
        ref={ref} autoPlay muted playsInline
        style={{ transform: zoom && zoom > 1 ? `scale(${zoom})` : undefined }}
        className="w-full h-full object-cover transition-transform duration-150"
      />
      {label && (
        <span className="absolute bottom-0.5 left-0.5 text-[9px] leading-none text-white/85 bg-black/60 px-1 py-0.5 rounded">
          {label}
        </span>
      )}
    </div>
  )
}

interface FloatingCameraPiPProps {
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  myLabel: string
  getLabel?: (id: string) => string
  onFlipLocal?: () => void
  onTurnOffLocal?: () => void
  dualCamera?: boolean
  onToggleDual?: () => void
}

// Онооны самбарыг ХЭЗЭЭ Ч далдлахгүйн тулд энгийн үедээ хуудасны урсгалд
// (бусад блоктой адил, overlay биш) байрладаг жижигхэн зурвас — тиймээс
// доор нь байгаа онооны самбар шахагдахгүй, зөвхөн хуудас арай урт болно.
// Дарахад бүх дэлгэц дээгүүр том цонх (overlay) нээгдэж камер тохируулах
// (зум, сэлгэх, хоёр камер) хялбар болно; 3 секунд үйлдэлгүй бол эсвэл
// арын хар дэвсгэрийг дарвал буцаад жижигхэн зурвас руугаа орно.
export function FloatingCameraPiP({
  localStream, remoteStreams, myLabel, getLabel, onFlipLocal, onTurnOffLocal,
  dualCamera, onToggleDual,
}: FloatingCameraPiPProps) {
  const [expanded, setExpanded] = useState(false)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { zoom, zoomIn, zoomOut } = useZoom(3, 0.5)

  const remotes = [...remoteStreams.entries()]
  const count = (localStream ? 1 : 0) + remotes.length

  const scheduleCollapse = useCallback(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current)
    collapseTimer.current = setTimeout(() => setExpanded(false), COLLAPSE_MS)
  }, [])

  useEffect(() => () => { if (collapseTimer.current) clearTimeout(collapseTimer.current) }, [])

  if (count === 0) return null

  function handleOpen() {
    setExpanded(true)
    scheduleCollapse()
  }

  const controls = (
    <div
      className="absolute bottom-1.5 right-1.5 flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {localStream && !dualCamera && onFlipLocal && (
        <button
          onClick={() => { onFlipLocal(); scheduleCollapse() }}
          title="Камер солих"
          className="h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <SwitchCamera className="h-3.5 w-3.5" />
        </button>
      )}
      {onToggleDual && (
        <button
          onClick={() => { onToggleDual(); scheduleCollapse() }}
          title={dualCamera ? "Ганц камер" : "Ар+урд камер хамт нээх"}
          className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center active:scale-90 transition-transform",
            dualCamera ? "bg-primary text-primary-foreground" : "bg-black/60 text-white",
          )}
        >
          <PictureInPicture2 className="h-3.5 w-3.5" />
        </button>
      )}
      {localStream && (
        <div className="flex items-center gap-0.5 bg-black/60 rounded-full px-0.5 py-0.5">
          <button
            onClick={() => { zoomOut(); scheduleCollapse() }}
            title="Холдуулах"
            className="h-7 w-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="text-[9px] text-white/90 font-mono w-6 text-center leading-none select-none">
            {zoom.toFixed(1)}x
          </span>
          <button
            onClick={() => { zoomIn(); scheduleCollapse() }}
            title="Ойртуулах"
            className="h-7 w-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {localStream && onTurnOffLocal && (
        <button
          onClick={() => onTurnOffLocal()}
          title="Камер хаах"
          className="h-7 w-7 rounded-full bg-destructive/80 text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <VideoOff className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Байнга харагдах зурвас — хуудасны урсгалд, overlay биш тул онооны
          самбарыг хэзээ ч далдлахгүй */}
      <div
        onClick={handleOpen}
        className="shrink-0 flex gap-0.5 h-20 rounded-xl overflow-hidden border border-border/40 cursor-pointer"
      >
        {localStream && <Tile stream={localStream} label={myLabel} />}
        {remotes.map(([id, stream]) => (
          <Tile key={id} stream={stream} label={getLabel?.(id) ?? "Тоглогч"} />
        ))}
      </div>

      {/* Дарахад гарах том тохируулгын цонх — бүх дэлгэц дээгүүр, 3с эсвэл
          арын дэвсгэр дарахад хаагдаад дээрх зурвас руу буцна */}
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => { e.stopPropagation(); scheduleCollapse() }}
            className="relative w-full max-w-xs flex gap-1 h-72 rounded-2xl overflow-hidden border border-white/15 shadow-2xl"
          >
            {localStream && <Tile stream={localStream} label={myLabel} zoom={zoom} />}
            {remotes.map(([id, stream]) => (
              <Tile key={id} stream={stream} label={getLabel?.(id) ?? "Тоглогч"} />
            ))}
            {controls}
          </div>
        </div>
      )}
    </>
  )
}
