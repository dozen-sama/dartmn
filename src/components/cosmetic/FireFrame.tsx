"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"

// lottie-web нь window/document шаарддаг тул зөвхөн client-д ачаална
const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

const RENDERER = { preserveAspectRatio: "xMidYMid slice" }

/**
 * Animation effect давхарга — Lottie-г нэрний АРД ба ӨМНӨ давхарлана.
 * `file` нь /public доторх Lottie зам. Файл байхгүй бол юу ч харуулахгүй.
 */
export function EffectLayer({ file }: { file: string }) {
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

  return (
    <>
      <span className="np-fire-lottie np-fire-back" aria-hidden="true">
        <Lottie animationData={data} loop autoplay rendererSettings={RENDERER} />
      </span>
      <span className="np-fire-lottie np-fire-front" aria-hidden="true">
        <Lottie animationData={data} loop autoplay rendererSettings={RENDERER} />
      </span>
    </>
  )
}
