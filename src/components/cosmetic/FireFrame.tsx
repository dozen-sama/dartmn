"use client"

import { useId } from "react"

/**
 * Хүрээг тойрсон дүрэлзэх гал — SVG feTurbulence + feDisplacementMap-аар
 * дугуй булантай хүрээний зураасыг галын дөл болгон мушгиж, анивчуулна.
 * Эх элементдээ absolute-аар бүрхэнэ (.np-fire-svg).
 */
export function FireFrame() {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "")
  const fid = `npfire-${raw}`
  const gid = `npfireg-${raw}`

  return (
    <svg className="np-fire-svg" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe07a" />
          <stop offset="45%" stopColor="#ff7a1f" />
          <stop offset="100%" stopColor="#c01808" />
        </linearGradient>
        <filter id={fid} x="-35%" y="-35%" width="170%" height="170%">
          <feTurbulence type="fractalNoise" baseFrequency="0.028 0.055" numOctaves="3" seed="3" result="noise">
            <animate attributeName="baseFrequency" dur="3.5s"
              values="0.028 0.05; 0.032 0.09; 0.028 0.05" repeatCount="indefinite" />
            <animate attributeName="seed" dur="2.2s" values="1; 7; 1" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9"
            xChannelSelector="R" yChannelSelector="G" result="disp" />
          <feGaussianBlur in="disp" stdDeviation="0.8" />
        </filter>
      </defs>

      {/* Гадна зөөлөн дөл */}
      <rect x="4%" y="9%" width="92%" height="82%" rx="11" ry="11"
        fill="none" stroke={`url(#${gid})`} strokeWidth="4" opacity="0.55"
        filter={`url(#${fid})`} />
      {/* Дотор тод дөл */}
      <rect x="4%" y="9%" width="92%" height="82%" rx="11" ry="11"
        fill="none" stroke={`url(#${gid})`} strokeWidth="2" filter={`url(#${fid})`} />
    </svg>
  )
}
