"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Minus, PictureInPicture2, Plus, SwitchCamera, VideoOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { useZoom } from "@/hooks/useZoom"

const COLLAPSE_MS = 3000

function Tile({
  stream, mirrored, label, zoom,
}: {
  stream: MediaStream
  mirrored?: boolean
  label?: string
  zoom?: number
}) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => { if (ref.current) ref.current.srcObject = stream }, [stream])

  return (
    <div className="relative flex-1 h-full overflow-hidden bg-zinc-900">
      <div className={cn("w-full h-full", mirrored && "scale-x-[-1]")}>
        <video
          ref={ref} autoPlay muted playsInline
          style={{ transform: zoom && zoom > 1 ? `scale(${zoom})` : undefined }}
          className="w-full h-full object-cover transition-transform duration-150"
        />
      </div>
      {label && (
        <span className="absolute bottom-0.5 left-0.5 text-[8px] leading-none text-white/85 bg-black/60 px-1 py-0.5 rounded">
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

// Онооны самбарыг далдлахгүй жижигхэн PiP камер — дарахад томорч, камер
// хаах/зумын товч гарна; 3 секунд ямар нэг үйлдэлгүй байвал буцаад жижигрнэ.
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

  function handleTap() {
    setExpanded(true)
    scheduleCollapse()
  }

  return (
    <div
      onClick={handleTap}
      className={cn(
        "fixed z-40 bottom-20 right-3 flex gap-0.5 rounded-xl overflow-hidden",
        "shadow-lg shadow-black/40 border border-white/10 bg-black/40 cursor-pointer",
        "transition-[width,height] duration-200",
        expanded
          ? (count === 1 ? "w-28 h-32" : "w-52 h-32")
          : (count === 1 ? "w-14 h-14" : "w-28 h-14"),
      )}
    >
      {localStream && (
        <Tile stream={localStream} mirrored={!dualCamera} label={expanded ? myLabel : undefined} zoom={zoom} />
      )}
      {remotes.map(([id, stream]) => (
        <Tile key={id} stream={stream} label={expanded ? (getLabel?.(id) ?? "Тоглогч") : undefined} />
      ))}

      {expanded && (
        <div
          className="absolute bottom-1 right-1 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {localStream && !dualCamera && onFlipLocal && (
            <button
              onClick={() => { onFlipLocal(); scheduleCollapse() }}
              title="Камер солих"
              className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <SwitchCamera className="h-3 w-3" />
            </button>
          )}
          {onToggleDual && (
            <button
              onClick={() => { onToggleDual(); scheduleCollapse() }}
              title={dualCamera ? "Ганц камер" : "Ар+урд камер хамт нээх"}
              className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center active:scale-90 transition-transform",
                dualCamera ? "bg-primary text-primary-foreground" : "bg-black/60 text-white",
              )}
            >
              <PictureInPicture2 className="h-3 w-3" />
            </button>
          )}
          {localStream && (
            <div className="flex items-center gap-0.5 bg-black/60 rounded-full px-0.5 py-0.5">
              <button
                onClick={() => { zoomOut(); scheduleCollapse() }}
                title="Холдуулах"
                className="h-6 w-6 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-[8px] text-white/90 font-mono w-6 text-center leading-none select-none">
                {zoom.toFixed(1)}x
              </span>
              <button
                onClick={() => { zoomIn(); scheduleCollapse() }}
                title="Ойртуулах"
                className="h-6 w-6 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
          {localStream && onTurnOffLocal && (
            <button
              onClick={() => onTurnOffLocal()}
              title="Камер хаах"
              className="h-6 w-6 rounded-full bg-destructive/80 text-white flex items-center justify-center active:scale-90 transition-transform"
            >
              <VideoOff className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
