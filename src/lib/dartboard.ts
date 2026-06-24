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

  // Calibration taps stored as fractions of video width/height (resolution-independent)
  bullseye_pct?: { x: number; y: number }  // center
  t20_pct?:      { x: number; y: number }  // 12 o'clock
  t6_pct?:       { x: number; y: number }  // 3 o'clock (segment 6 treble) — enables affine transform
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
 * Derived parameters from calibration, computed at runtime per frame size.
 * With 3-point calibration, `affine` is set and positionToScoreCal uses it
 * instead of rotation-only correction — fixes shear from angled cameras.
 */
export interface DerivedCal {
  cx: number       // bullseye pixel x
  cy: number       // bullseye pixel y
  scale: number    // pixels per board-radius unit (outer double ring)
  rotation: number // radians: camera tilt (used only in 2-point fallback)
  // 3-point affine matrix [a,b,c; d,e,f] mapping pixel→board space (board radius = 1.0)
  affine?: { a: number; b: number; c: number; d: number; e: number; f: number }
}

/**
 * Compute runtime calibration from stored percentages and actual frame dimensions.
 *
 * With 3 taps (bullseye + T20 + T6):
 *   Solves a 2×3 affine matrix that maps pixel coords → normalized board coords
 *   (where board center = 0,0 and outer double ring = radius 1.0).
 *   Board reference frame: T20 at (0, -T20_NORM_DIST), T6 at (+T20_NORM_DIST, 0).
 *
 * With 2 taps (bullseye + T20):
 *   Rotation + uniform scale only.
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
    const rotation = Math.atan2(dx, -dy)
    const scale = dist / T20_NORM_DIST

    if (cal.t6_pct) {
      // 3-point affine: board axes are T20 (up) and T6 (right), both at T20_NORM_DIST.
      // Affine: pixel = A * board + t  →  board = A_inv * (pixel - t)
      // From bullseye (board origin): c = bx, f = by
      // From T20 at board (0, -D): b = (tx-bx)/(-D), e = (ty-by)/(-D)
      // From T6 at board (+D, 0): a = (t6x-bx)/D,    d = (t6y-by)/D
      const D = T20_NORM_DIST
      const t6x = cal.t6_pct.x * W
      const t6y = cal.t6_pct.y * H
      const a = (t6x - bx) / D
      const b = (tx  - bx) / (-D)
      const c = bx
      const d = (t6y - by) / D
      const e = (ty  - by) / (-D)
      const f = by
      return { cx: bx, cy: by, scale, rotation, affine: { a, b, c, d, e, f } }
    }

    return { cx: bx, cy: by, scale, rotation }
  }
  // Fallback: use circle overlay (no rotation correction)
  return { cx: cal.cx_pct * W, cy: cal.cy_pct * H, scale: cal.r_pct * W, rotation: 0 }
}

/**
 * Convert a raw pixel position to a dart score using calibration data.
 *
 * With 3-point affine: applies full affine inverse → normalized board coords → score.
 * With 2-point rotation: applies inverse rotation + scale → score.
 */
export function positionToScoreCal(
  px: number, py: number,
  cal: DerivedCal,
): DartScore {
  if (cal.affine) {
    // Invert affine: board = A^-1 * (pixel - t)
    // A = [[a,b],[d,e]], t = [c,f]
    const { a, b, c, d, e, f } = cal.affine
    const det = a * e - b * d
    if (Math.abs(det) < 1e-6) {
      // Degenerate (T20 and T6 collinear with bullseye) — fall through to rotation
    } else {
      const px0 = px - c, py0 = py - f
      const boardX = ( e * px0 - b * py0) / det
      const boardY = (-d * px0 + a * py0) / det
      // Board coords are normalized so outer double ring = 1.0
      return positionToScore(boardX, boardY, 1.0)
    }
  }
  // 2-point: rotation + uniform scale
  const rdx = px - cal.cx
  const rdy = py - cal.cy
  const cos = Math.cos(-cal.rotation)
  const sin = Math.sin(-cal.rotation)
  return positionToScore(rdx * cos - rdy * sin, rdx * sin + rdy * cos, cal.scale)
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
