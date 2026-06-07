"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"

// lottie-web нь window/document шаарддаг тул зөвхөн client-д ачаална
const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

const RENDERER = { preserveAspectRatio: "none" }

/**
 * Шатаж буй хүрээ — Lottie галын animation, нэрний АРД ба ӨМНӨ давхарлана.
 * /public/lottie/fire.json-г runtime-д татна. Файл байхгүй бол юу ч харуулахгүй.
 */
export function FireFrame() {
  const [data, setData] = useState<object | null>(null)

  useEffect(() => {
    let active = true
    fetch("/lottie/fire.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no asset"))))
      .then((d) => { if (active) setData(d) })
      .catch(() => { /* asset байхгүй — алгасна */ })
    return () => { active = false }
  }, [])

  if (!data) return null

  return (
    <>
      {/* Нэрний ард */}
      <span className="np-fire-lottie np-fire-back" aria-hidden="true">
        <Lottie animationData={data} loop autoplay rendererSettings={RENDERER} />
      </span>
      {/* Нэрний өмнө (зөвхөн тод дөл харагдана) */}
      <span className="np-fire-lottie np-fire-front" aria-hidden="true">
        <Lottie animationData={data} loop autoplay rendererSettings={RENDERER} />
      </span>
    </>
  )
}
