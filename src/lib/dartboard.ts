// Dartboard geometry — standard WDF/BDO dimensions
// Outer double ring = reference radius (1.0)

const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

const R = {
  bullseye:    6.35 / 170,
  bull:        16   / 170,
  singleInner: 99   / 170,
  tripleOuter: 107  / 170,
  singleOuter: 162  / 170,
  doubleOuter: 170  / 170,
}

// T20 center sits at the middle of the treble ring (~103mm from board center)
const T20_NORM_DIST = 103 / 170  // 0.606

export interface DartScore {
  score: number
  label: string
  segment: number
  multiplier: 0 | 1 | 2 | 3
}

/**
 * positionToScore — raw, axis-aligned coordinates.
 * dx, dy: pixels from board center. dy positive = downward on screen.
 * boardRadius: outer double ring radius in pixels.
 */
export function positionToScore(dx: number, dy: number, boardRadius: number): DartScore {
  const dist = Math.sqrt(dx * dx + dy * dy)
  const r = dist / boardRadius

  if (r > R.doubleOuter) return { score: 0,  label: "Miss",  segment: 0, multiplier: 0 }
  if (r <= R.bullseye)   return { score: 50, label: "DBull", segment: 0, multiplier: 2 }
  if (r <= R.bull)       return { score: 25, label: "SBull", segment: 0, multiplier: 1 }

  const angleDeg = ((Math.atan2(dx, -dy) * (180 / Math.PI)) + 360) % 360
  const segIndex = Math.floor(((angleDeg + 9) % 360) / 18) % 20
  const seg = SEGMENTS[segIndex]

  if (r <= R.singleInner) return { score: seg,     label: `S${seg}`, segment: seg, multiplier: 1 }
  if (r <= R.tripleOuter) return { score: seg * 3, label: `T${seg}`, segment: seg, multiplier: 3 }
  if (r <= R.singleOuter) return { score: seg,     label: `S${seg}`, segment: seg, multiplier: 1 }
  return                         { score: seg * 2,  label: `D${seg}`, segment: seg, multiplier: 2 }
}

// ── Calibration ───────────────────────────────────────────────────────────────

export interface BoardCalibration {
  // Overlay circle (fraction of video dimensions)
  cx_pct: number
  cy_pct: number
  r_pct: number

  // 2-point calibration result (computed from bullseye + T20 taps)
  // Stored as fractions of video width/height so they're resolution-independent.
  bullseye_pct?: { x: number; y: number }  // user-tapped bullseye
  t20_pct?:      { x: number; y: number }  // user-tapped T20
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
  return { cx_pct: 0.5, cy_pct: 0.5, r_pct: 0.26 }
}

/**
 * Derived parameters from 2-point calibration, computed at runtime per frame size.
 */
export interface DerivedCal {
  cx: number       // bullseye pixel x
  cy: number       // bullseye pixel y
  scale: number    // pixels per board-radius unit
  rotation: number // radians: camera tilt correction (clockwise)
}

/**
 * Compute runtime calibration from stored percentages and actual frame dimensions.
 */
export function deriveCal(cal: BoardCalibration, W: number, H: number): DerivedCal {
  if (cal.bullseye_pct && cal.t20_pct) {
    const bx = cal.bullseye_pct.x * W
    const by = cal.bullseye_pct.y * H
    const tx = cal.t20_pct.x * W
    const ty = cal.t20_pct.y * H
    const dx = tx - bx
    const dy = ty - by
    const dist = Math.sqrt(dx * dx + dy * dy)
    // rotation: angle from "up" (-Y) to the T20 vector, clockwise positive
    const rotation = Math.atan2(dx, -dy)
    const scale = dist / T20_NORM_DIST
    return { cx: bx, cy: by, scale, rotation }
  }
  // Fallback: use circle overlay (no rotation correction)
  return {
    cx: cal.cx_pct * W,
    cy: cal.cy_pct * H,
    scale: cal.r_pct * W,
    rotation: 0,
  }
}

/**
 * Convert a raw pixel position to a dart score using the 2-point calibration.
 * Corrects for camera rotation/angle.
 */
export function positionToScoreCal(
  px: number, py: number,
  cal: DerivedCal,
): DartScore {
  // 1. Translate to board center
  const rdx = px - cal.cx
  const rdy = py - cal.cy
  // 2. Apply inverse rotation to align T20 with the true "up" direction
  const cos = Math.cos(-cal.rotation)
  const sin = Math.sin(-cal.rotation)
  const corrX = rdx * cos - rdy * sin
  const corrY = rdx * sin + rdy * cos
  // 3. Score using board geometry
  return positionToScore(corrX, corrY, cal.scale)
}

// ── Frame analysis ────────────────────────────────────────────────────────────

/**
 * Find where a dart landed by comparing two frames.
 * Only considers pixels INSIDE the board circle to ignore flights/shaft.
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
  const d1 = refData.data
  const d2 = curData.data
  const r2 = boardRadius * boardRadius * 1.05

  let sumX = 0, sumY = 0, count = 0

  for (let y = 0; y < refData.height; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - boardCx
      const dy = y - boardCy
      if (dx * dx + dy * dy > r2) continue

      const i = (y * W + x) * 4
      const diff =
        Math.abs(d2[i]     - d1[i]) +
        Math.abs(d2[i + 1] - d1[i + 1]) +
        Math.abs(d2[i + 2] - d1[i + 2])
      if (diff > threshold) { sumX += x; sumY += y; count++ }
    }
  }

  if (count < 40) return null
  return { px: sumX / count, py: sumY / count, pixelCount: count }
}

/**
 * Measure whole-frame motion. Returns fraction of changed pixels.
 */
export function measureMotion(a: ImageData, b: ImageData, threshold = 20): number {
  let changed = 0
  for (let i = 0; i < a.data.length; i += 4) {
    const diff = Math.abs(b.data[i] - a.data[i]) + Math.abs(b.data[i+1] - a.data[i+1]) + Math.abs(b.data[i+2] - a.data[i+2])
    if (diff > threshold) changed++
  }
  return changed / (a.data.length / 4)
}
