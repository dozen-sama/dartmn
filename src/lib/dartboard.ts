// Dartboard geometry — standard WDF/BDO dimensions
// Outer double ring = reference radius (1.0)

const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

// Normalized radii (relative to outer double ring = 170mm total)
const R = {
  bullseye:      6.35 / 170,   // 0.037 — inner bull (50)
  bull:          16   / 170,   // 0.094 — outer bull (25)
  singleInner:   99   / 170,   // 0.582 — inner single → triple ring starts
  tripleOuter:   107  / 170,   // 0.629 — triple ring ends
  singleOuter:   162  / 170,   // 0.953 — outer single → double ring starts
  doubleOuter:   170  / 170,   // 1.0   — outer double ring ends (miss beyond)
}

export interface DartScore {
  score: number
  label: string    // "T20", "S5", "DBull", "Miss" …
  segment: number  // 1-20, 0 for bull/miss
  multiplier: 0 | 1 | 2 | 3
}

/**
 * Convert a position relative to the dartboard center to a dart score.
 * dx, dy: offset from board center in pixels.
 * boardRadius: radius of the outer double ring in pixels.
 */
export function positionToScore(dx: number, dy: number, boardRadius: number): DartScore {
  const dist = Math.sqrt(dx * dx + dy * dy)
  const r = dist / boardRadius // normalized radius

  if (r > R.doubleOuter) return { score: 0, label: "Miss", segment: 0, multiplier: 0 }
  if (r <= R.bullseye)   return { score: 50, label: "DBull", segment: 0, multiplier: 2 }
  if (r <= R.bull)       return { score: 25, label: "SBull", segment: 0, multiplier: 1 }

  // Angle: 0° at top (12-o'clock), clockwise positive
  // atan2(dx, -dy) gives clockwise from top
  const angleDeg = ((Math.atan2(dx, -dy) * (180 / Math.PI)) + 360) % 360

  // Each segment is 18°. Segment 20 is centered at 0°.
  // Add 9° offset so segment 20 occupies [-9°, 9°].
  const segIndex = Math.floor(((angleDeg + 9) % 360) / 18) % 20
  const seg = SEGMENTS[segIndex]

  if (r <= R.singleInner)  return { score: seg,     label: `S${seg}`, segment: seg, multiplier: 1 }
  if (r <= R.tripleOuter)  return { score: seg * 3, label: `T${seg}`, segment: seg, multiplier: 3 }
  if (r <= R.singleOuter)  return { score: seg,     label: `S${seg}`, segment: seg, multiplier: 1 }
  return                          { score: seg * 2,  label: `D${seg}`, segment: seg, multiplier: 2 }
}

export interface BoardCalibration {
  cx_pct: number   // center x as fraction of video width  (0-1)
  cy_pct: number   // center y as fraction of video height (0-1)
  r_pct: number    // radius as fraction of video width    (0-1)
}

const CAL_KEY = "dart-board-cal"

export function saveCalibration(cal: BoardCalibration) {
  sessionStorage.setItem(CAL_KEY, JSON.stringify(cal))
}

export function loadCalibration(): BoardCalibration {
  try {
    const s = sessionStorage.getItem(CAL_KEY)
    if (s) return JSON.parse(s) as BoardCalibration
  } catch {}
  // Default: circle at center, 26% of width (matches CameraSetup overlay)
  return { cx_pct: 0.5, cy_pct: 0.5, r_pct: 0.26 }
}

/**
 * Analyze two canvas frames and find where a dart landed.
 * Only considers changed pixels INSIDE the board circle (ignores flights/shaft outside board).
 * Returns the centroid of changed pixels within the board area, or null if nothing found.
 */
export function detectDartInFrames(
  refData: ImageData,
  curData: ImageData,
  boardCx: number,
  boardCy: number,
  boardRadius: number,
  threshold = 25,
): { px: number; py: number; pixelCount: number } | null {
  const W = refData.width
  const H = refData.height
  const d1 = refData.data
  const d2 = curData.data

  let sumX = 0, sumY = 0, count = 0

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Only consider pixels inside the board circle + small margin
      const dx = x - boardCx
      const dy = y - boardCy
      if (dx * dx + dy * dy > boardRadius * boardRadius * 1.1) continue

      const i = (y * W + x) * 4
      const diff =
        Math.abs(d2[i]     - d1[i]) +
        Math.abs(d2[i + 1] - d1[i + 1]) +
        Math.abs(d2[i + 2] - d1[i + 2])

      if (diff > threshold) {
        sumX += x
        sumY += y
        count++
      }
    }
  }

  if (count < 40) return null
  return { px: sumX / count, py: sumY / count, pixelCount: count }
}

/**
 * Measure total motion between two frames (whole frame).
 * Used for motion detection to trigger dart scoring.
 */
export function measureMotion(refData: ImageData, curData: ImageData, threshold = 20): number {
  const d1 = refData.data
  const d2 = curData.data
  let changed = 0
  for (let i = 0; i < d1.length; i += 4) {
    const diff = Math.abs(d2[i] - d1[i]) + Math.abs(d2[i+1] - d1[i+1]) + Math.abs(d2[i+2] - d1[i+2])
    if (diff > threshold) changed++
  }
  return changed / (d1.length / 4) // fraction of changed pixels
}
