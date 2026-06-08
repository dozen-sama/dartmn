"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"

// lottie-web нь window/document шаарддаг тул зөвхөн client-д ачаална
const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

type Fit = "cover" | "contain" | "stretch"

/**
 * Animation effect давхарга — Lottie-г нэрний АРД ба ӨМНӨ давхарлана.
 * `file` нь /public доторх Lottie зам. fit/scale-аар хэмжээг тааруулна.
 * Файл байхгүй бол юу ч харуулахгүй.
 */
export function EffectLayer({ file, fit = "cover", scale = 1, scaleY, offsetX = 0, offsetY = 0, single = false, animated = true }: { file: string; fit?: Fit; scale?: number; scaleY?: number; offsetX?: number; offsetY?: number; single?: boolean; animated?: boolean }) {
  const [data, setData] = useState<object | null>(null)

  useEffect(() => {
    if (!file) return
    let active = true
    fetch(file)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no asset"))))
      .then((d) => { if (active) setData(d) })
      .catch(() => { /* asset байхгүй — алгасна */ })
    return () => { active = false }
  }, [file])

  if (!data) return null

  const par = fit === "stretch" ? "none" : fit === "contain" ? "xMidYMid meet" : "xMidYMid slice"
  const renderer = { preserveAspectRatio: par }
  // Байрлал (offset) + хэмжээ (scale X, Y). Голоос томрох/сунгах (transform-origin: center)
  const sy = scaleY ?? scale
  const style = { transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale}, ${sy})`, transformOrigin: "center" }

  // animated=false → эхний кадр дээр зогсоож (static) харуулна
  return (
    <>
      <span className="np-fire-lottie np-fire-back" style={style} aria-hidden="true">
        <Lottie animationData={data} loop={animated} autoplay={animated} rendererSettings={renderer} />
      </span>
      {!single && (
        <span className="np-fire-lottie np-fire-front" style={style} aria-hidden="true">
          <Lottie animationData={data} loop={animated} autoplay={animated} rendererSettings={renderer} />
        </span>
      )}
    </>
  )
}
