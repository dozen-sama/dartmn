"use client"

// YOLOv8n dart tip detection — onnxruntime-web (browser-only, lazy loaded)

// dart-sense classes: {0:'20', 1:'3', 2:'11', 3:'6', 4:'dart', 5:'9', 6:'15'}
const DART_CLASS_INDEX = 4
const MODEL_INPUT_SIZE = 640
const CONF_THRESHOLD = 0.35
const IOU_THRESHOLD = 0.45

export interface DartDetection {
  cx: number
  cy: number
  // Bottom-center of bounding box — closer to dart tip
  tipX: number
  tipY: number
  confidence: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let session: any = null
let warmupDone = false

export async function loadDartModel(modelPath = "/models/dart.onnx"): Promise<void> {
  if (session) return
  // Dynamic import — onnxruntime-web is browser-only, never bundled server-side
  const ort = await import("onnxruntime-web")
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/"
  session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ["webgpu", "wasm"],
    graphOptimizationLevel: "all",
  })
}

export function isDartModelLoaded(): boolean {
  return session !== null
}

async function preprocess(imageData: ImageData) {
  const ort = await import("onnxruntime-web")
  const { width: srcW, height: srcH } = imageData

  const scale = Math.min(MODEL_INPUT_SIZE / srcW, MODEL_INPUT_SIZE / srcH)
  const newW = Math.round(srcW * scale)
  const newH = Math.round(srcH * scale)
  const padX = Math.floor((MODEL_INPUT_SIZE - newW) / 2)
  const padY = Math.floor((MODEL_INPUT_SIZE - newH) / 2)

  const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#808080"
  ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)

  const srcCanvas = new OffscreenCanvas(srcW, srcH)
  srcCanvas.getContext("2d")!.putImageData(imageData, 0, 0)
  ctx.drawImage(srcCanvas, padX, padY, newW, newH)

  const resized = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
  const N = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE
  const data = new Float32Array(3 * N)
  for (let i = 0; i < N; i++) {
    data[i]         = resized.data[i * 4]     / 255
    data[N + i]     = resized.data[i * 4 + 1] / 255
    data[N * 2 + i] = resized.data[i * 4 + 2] / 255
  }

  const tensor = new ort.Tensor("float32", data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE])
  return { tensor, scale, padX, padY }
}

function nms(boxes: number[][], scores: number[], iouThreshold: number): number[] {
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).map(v => v[1])
  const keep: number[] = []
  const suppressed = new Set<number>()
  for (const i of order) {
    if (suppressed.has(i)) continue
    keep.push(i)
    for (const j of order) {
      if (suppressed.has(j) || j === i) continue
      if (boxIou(boxes[i], boxes[j]) > iouThreshold) suppressed.add(j)
    }
  }
  return keep
}

function boxIou(a: number[], b: number[]): number {
  const ix1 = Math.max(a[0], b[0]), iy1 = Math.max(a[1], b[1])
  const ix2 = Math.min(a[2], b[2]), iy2 = Math.min(a[3], b[3])
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1)
  return inter / ((a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - inter + 1e-6)
}

// ── Board corner detection for auto-calibration ─────────────────────────────

// dart-sense classes: {0:'20', 1:'3', 2:'11', 3:'6', 4:'dart', 5:'9', 6:'15'}
// Segments 20, 3, 11, 6 are at 90° intervals — used to compute board center
const BOARD_CORNERS: Record<number, number> = {
  0: 0,    // segment 20 → 0° (top)
  1: 180,  // segment 3  → 180° (bottom)
  2: 270,  // segment 11 → 270° (left)
  3: 90,   // segment 6  → 90° (right)
}
// Model detects "upper-left corner of double ring" — consistently 9° CCW from segment center
const CORNER_OFFSET_DEG = 9
const T20_NORM_DIST = 103 / 170  // treble ring / outer double

export interface BoardCorner {
  segment: number
  angleDeg: number  // nominal angle (0/90/180/270)
  cx: number        // 320x240 image coords
  cy: number
  confidence: number
}

async function runInference(imageData: ImageData) {
  const { tensor, scale, padX, padY } = await preprocess(imageData)
  if (!warmupDone) { await session.run({ images: tensor }); warmupDone = true }
  const results = await session.run({ images: tensor })
  const outputKey = Object.keys(results)[0]
  return { output: results[outputKey].data as Float32Array, dims: results[outputKey].dims, scale, padX, padY }
}

export async function detectBoardCorners(imageData: ImageData): Promise<BoardCorner[]> {
  if (!session) return []
  const { output, dims, scale, padX, padY } = await runInference(imageData)
  const numBoxes = dims[2], numFields = dims[1]

  const bestByClass = new Map<number, { cx: number; cy: number; score: number }>()

  for (let i = 0; i < numBoxes; i++) {
    const cx = output[0 * numBoxes + i]
    const cy = output[1 * numBoxes + i]
    const w  = output[2 * numBoxes + i]
    const h  = output[3 * numBoxes + i]
    let maxConf = 0, maxCls = 0
    for (let c = 0; c < numFields - 4; c++) {
      const conf = output[(4 + c) * numBoxes + i]
      if (conf > maxConf) { maxConf = conf; maxCls = c }
    }
    if (!(maxCls in BOARD_CORNERS) || maxConf < 0.25) continue
    const existing = bestByClass.get(maxCls)
    if (!existing || maxConf > existing.score) {
      const imgCx = ((cx - w/2 + cx + w/2) / 2 - padX) / scale
      const imgCy = ((cy - h/2 + cy + h/2) / 2 - padY) / scale
      bestByClass.set(maxCls, { cx: imgCx, cy: imgCy, score: maxConf })
    }
  }

  return Array.from(bestByClass.entries()).map(([cls, { cx, cy, score }]) => ({
    segment: [20, 3, 11, 6][cls] ?? 0,
    angleDeg: BOARD_CORNERS[cls],
    cx, cy,
    confidence: score,
  }))
}

/**
 * Compute calibration from detected board corners.
 * Returns calibration in 0-1 percentages for a 320×240 capture frame.
 * Returns null if insufficient corners detected.
 */
export function computeCalFromCorners(
  corners: BoardCorner[],
  frameW = 320,
  frameH = 240,
): { cx_pct: number; cy_pct: number; r_pct: number; bullseye_pct: { x: number; y: number }; t20_pct: { x: number; y: number }; t6_pct: { x: number; y: number } } | null {
  const byAngle = new Map(corners.map(c => [c.angleDeg, c]))
  const c0   = byAngle.get(0)    // segment 20 (top)
  const c90  = byAngle.get(90)   // segment 6 (right)
  const c180 = byAngle.get(180)  // segment 3 (bottom)
  const c270 = byAngle.get(270)  // segment 11 (left)

  // Board center from opposite pairs
  let bxSum = 0, bySum = 0, count = 0
  if (c0 && c180) { bxSum += (c0.cx + c180.cx) / 2; bySum += (c0.cy + c180.cy) / 2; count++ }
  if (c90 && c270) { bxSum += (c90.cx + c270.cx) / 2; bySum += (c90.cy + c270.cy) / 2; count++ }
  if (count === 0) return null  // no opposite pairs

  const bx = bxSum / count
  const by = bySum / count

  // Board radius (outer double ring in pixels)
  const available = [c0, c90, c180, c270].filter(Boolean) as BoardCorner[]
  if (available.length < 2) return null
  const r = available.reduce((s, c) => s + Math.sqrt((c.cx-bx)**2 + (c.cy-by)**2), 0) / available.length

  // Compute T20 and T6 treble positions from detected outer-double corners
  // 1. Choose best corner: class 0 for T20, class 3 for T6 (else estimate from opposite)
  const getT20src = c0 ?? (c180 ? { cx: 2*bx - c180.cx, cy: 2*by - c180.cy } : null)
  const getT6src  = c90 ?? (c270 ? { cx: 2*bx - c270.cx, cy: 2*by - c270.cy } : null)
  if (!getT20src || !getT6src) return null

  // 2. Correct 9° offset (model detects upper-left corner, not segment center)
  function correctCorner(cx: number, cy: number) {
    const dx = cx - bx, dy = cy - by
    const angle = Math.atan2(dx, -dy)
    const corrected = angle + (CORNER_OFFSET_DEG * Math.PI / 180)
    const dist = Math.sqrt(dx*dx + dy*dy)
    return { x: bx + dist * Math.sin(corrected), y: by - dist * Math.cos(corrected) }
  }

  const t20corr = correctCorner(getT20src.cx, getT20src.cy)
  const t6corr  = correctCorner(getT6src.cx, getT6src.cy)

  // 3. Scale from outer double (r) to treble ring (T20_NORM_DIST × r)
  function scaleToTreble(p: { x: number; y: number }) {
    return {
      x: bx + (p.x - bx) * T20_NORM_DIST,
      y: by + (p.y - by) * T20_NORM_DIST,
    }
  }

  const t20 = scaleToTreble(t20corr)
  const t6  = scaleToTreble(t6corr)

  return {
    cx_pct:       bx / frameW,
    cy_pct:       by / frameH,
    r_pct:        r  / frameW,
    bullseye_pct: { x: bx / frameW, y: by / frameH },
    t20_pct:      { x: t20.x / frameW, y: t20.y / frameH },
    t6_pct:       { x: t6.x  / frameW, y: t6.y  / frameH },
  }
}

export async function detectDarts(imageData: ImageData): Promise<DartDetection[]> {
  if (!session) return []

  const { output, dims, scale, padX, padY } = await runInference(imageData)
  const numBoxes = dims[2]
  const numFields = dims[1]

  const dartBoxes: number[][] = []
  const dartScores: number[] = []

  for (let i = 0; i < numBoxes; i++) {
    const cx = output[0 * numBoxes + i]
    const cy = output[1 * numBoxes + i]
    const w  = output[2 * numBoxes + i]
    const h  = output[3 * numBoxes + i]

    let maxConf = 0, maxCls = 0
    for (let c = 0; c < numFields - 4; c++) {
      const conf = output[(4 + c) * numBoxes + i]
      if (conf > maxConf) { maxConf = conf; maxCls = c }
    }

    if (maxCls !== DART_CLASS_INDEX || maxConf < CONF_THRESHOLD) continue
    dartBoxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])
    dartScores.push(maxConf)
  }

  if (!dartBoxes.length) return []
  const kept = nms(dartBoxes, dartScores, IOU_THRESHOLD)

  return kept.map(idx => {
    const [x1, y1, x2, y2] = dartBoxes[idx]
    const origCx  = ((x1 + x2) / 2 - padX) / scale
    const origCy  = ((y1 + y2) / 2 - padY) / scale
    const origTipX = ((x1 + x2) / 2 - padX) / scale
    const origTipY = (y2 - padY) / scale
    return { cx: origCx, cy: origCy, tipX: origTipX, tipY: origTipY, confidence: dartScores[idx] }
  })
}
