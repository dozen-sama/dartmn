"use client"

import { Minus, Plus, SwitchCamera } from "lucide-react"
import { cn } from "@/lib/utils"

interface CameraControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFlip?: () => void
  className?: string
}

export function CameraControls({ zoom, onZoomIn, onZoomOut, onFlip, className }: CameraControlsProps) {
  return (
    <div className={cn("absolute bottom-1 right-1 flex items-center gap-1", className)}>
      {onFlip && (
        <button
          onClick={(e) => { e.stopPropagation(); onFlip() }}
          title="Камер солих"
          className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center active:scale-90 transition-transform"
        >
          <SwitchCamera className="h-3 w-3" />
        </button>
      )}
      <div className="flex items-center gap-0.5 bg-black/60 rounded-full px-0.5 py-0.5">
        <button
          onClick={(e) => { e.stopPropagation(); onZoomOut() }}
          title="Холдуулах"
          className="h-6 w-6 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="text-[9px] text-white/90 font-mono w-7 text-center leading-none select-none">
          {zoom.toFixed(1)}x
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onZoomIn() }}
          title="Ойртуулах"
          className="h-6 w-6 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
