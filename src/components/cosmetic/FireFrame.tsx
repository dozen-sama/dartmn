"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"

// lottie-web нь window/document шаарддаг тул зөвхөн client-д ачаална
const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

/**
 * Шатаж буй хүрээ — Lottie галын animation.
 * /public/lottie/fire.json файлыг runtime-д татаж тоглуулна.
 * Файл байхгүй бол юу ч харуулахгүй (хүрээ зүгээр гэрэлтэнэ).
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
    <span className="np-fire-lottie" aria-hidden="true">
      <Lottie animationData={data} loop autoplay />
    </span>
  )
}
