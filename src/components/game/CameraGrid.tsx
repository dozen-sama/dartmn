"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

function VideoTile({
  stream, mirrored, label,
}: {
  stream: MediaStream
  mirrored?: boolean
  label?: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])

  return (
    <div className="relative rounded-lg overflow-hidden bg-zinc-900 aspect-video">
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        className={cn("w-full h-full object-cover", mirrored && "scale-x-[-1]")}
      />
      {label && (
        <span className="absolute bottom-1 left-1 text-[9px] text-white/80 bg-black/60 px-1 rounded leading-none py-0.5">
          {label}
        </span>
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
}

export function CameraGrid({
  localStream, remoteStreams, myLabel = "Та", getLabel, className,
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
        <VideoTile stream={localStream} mirrored label={myLabel} />
      )}
      {remotes.map(([id, stream]) => (
        <VideoTile key={id} stream={stream} label={getLabel?.(id) ?? "Тоглогч"} />
      ))}
    </div>
  )
}
