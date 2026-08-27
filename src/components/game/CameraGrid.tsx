"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useZoom } from "@/hooks/useZoom"
import { CameraControls } from "./CameraControls"

function VideoTile({
  stream, mirrored, label, controllable, onFlip,
}: {
  stream: MediaStream
  mirrored?: boolean
  label?: string
  controllable?: boolean
  onFlip?: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const { zoom, zoomIn, zoomOut } = useZoom(3, 0.5)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  return (
    <div className="relative rounded-lg overflow-hidden bg-zinc-900 aspect-video">
      <div className={cn("w-full h-full", mirrored && "scale-x-[-1]")}>
        <video
          ref={ref}
          autoPlay
          muted
          playsInline
          style={{ transform: zoom > 1 ? `scale(${zoom})` : undefined }}
          className="w-full h-full object-cover transition-transform duration-150"
        />
      </div>
      {label && (
        <span className="absolute bottom-1 left-1 text-[9px] text-white/80 bg-black/60 px-1 rounded leading-none py-0.5">
          {label}
        </span>
      )}
      {controllable && (
        <CameraControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} onFlip={onFlip} />
      )}
    </div>
  )
}

interface CameraGridProps {
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  myLabel?: string
  getLabel?: (id: string) => string
  className?: string
  onFlipLocal?: () => void
}

export function CameraGrid({
  localStream, remoteStreams, myLabel = "Та", getLabel, className, onFlipLocal,
}: CameraGridProps) {
  const remotes = [...remoteStreams.entries()]
  const total = (localStream ? 1 : 0) + remotes.length

  if (total === 0) return null

  return (
    <div className={cn(
      "grid gap-1",
      total === 1 ? "grid-cols-1 max-w-[160px]" : "grid-cols-2",
      className,
    )}>
      {localStream && (
        <VideoTile stream={localStream} mirrored label={myLabel} controllable onFlip={onFlipLocal} />
      )}
      {remotes.map(([id, stream]) => (
        <VideoTile key={id} stream={stream} label={getLabel?.(id) ?? "Тоглогч"} />
      ))}
    </div>
  )
}
