"use client"

import { useCallback, useRef, useState } from "react"

// Камерын зумын төлөв. zoomRef нь setInterval/callback дотор stale closure-гүйгээр
// хамгийн сүүлийн утгыг унших зориулалттай.
export function useZoom(max = 3, step = 0.5) {
  const [zoom, setZoomState] = useState(1)
  const zoomRef = useRef(1)

  const setZoom = useCallback((z: number) => {
    const clamped = Math.min(max, Math.max(1, Math.round(z * 10) / 10))
    zoomRef.current = clamped
    setZoomState(clamped)
  }, [max])

  const zoomIn = useCallback(() => setZoom(zoomRef.current + step), [setZoom, step])
  const zoomOut = useCallback(() => setZoom(zoomRef.current - step), [setZoom, step])
  const reset = useCallback(() => setZoom(1), [setZoom])

  return { zoom, zoomRef, zoomIn, zoomOut, reset, setZoom }
}
