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
export function EffectLayer({ file, fit = "cover", scale = 1, offsetX = 0, offsetY = 0 }: { file: string; fit?: Fit; scale?: number; offsetX?: number; offsetY?: number }) {
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
  const hasTransform = scale !== 1 || offsetX !== 0 || offsetY !== 0
  const style = hasTransform ? { transform: `translate(${offsetX}%, ${offsetY}%) scale(${scale})` } : undefined

  return (
    <>
      <span className="np-fire-lottie np-fire-back" style={style} aria-hidden="true">
        <Lottie animationData={data} loop autoplay rendererSettings={renderer} />
      </span>
      <span className="np-fire-lottie np-fire-front" style={style} aria-hidden="true">
        <Lottie animationData={data} loop autoplay rendererSettings={renderer} />
      </span>
    </>
  )
}
