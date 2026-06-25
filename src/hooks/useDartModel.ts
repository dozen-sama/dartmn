"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { loadDartModel, detectDarts, isDartModelLoaded, type DartDetection } from "@/lib/dart-model"

interface UseDartModelReturn {
  modelReady: boolean
  detectDart: (imageData: ImageData) => Promise<DartDetection | null>
}

export function useDartModel(): UseDartModelReturn {
  const [modelReady, setModelReady] = useState(false)
  const loadingRef = useRef(false)

  useEffect(() => {
    if (loadingRef.current || isDartModelLoaded()) return
    loadingRef.current = true
    loadDartModel().then(() => {
      setModelReady(true)
    }).catch((err) => {
      console.warn("YOLO model load failed — will use frame-diff fallback:", err)
    })
  }, [])

  // useCallback — render бүрд шинэ функц үүсгэхгүй
  // Энэ байхгүй бол camera/page useEffect тасралтгүй restart хийнэ
  const detectDart = useCallback(async (imageData: ImageData): Promise<DartDetection | null> => {
    if (!isDartModelLoaded()) return null
    const results = await detectDarts(imageData)
    if (!results.length) return null
    return results.reduce((best, d) => d.confidence > best.confidence ? d : best)
  }, [])

  return { modelReady, detectDart }
}
