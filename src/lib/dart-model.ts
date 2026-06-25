"use client"

// YOLOv8n dart tip detection — onnxruntime-web
// Model: dart-sense (bnww/dart-sense) converted to ONNX
// Detects dart tip positions on the dartboard in real-time.

import * as ort from "onnxruntime-web"

// dart-sense class names (confirmed after export)
// index 0 = dart tip, others = calibration corners
const DART_CLASS_INDEX = 0
const MODEL_INPUT_SIZE = 640
const CONF_THRESHOLD = 0.35
const IOU_THRESHOLD = 0.45

export interface DartDetection {
  // Center of bounding box in INPUT image coordinates (0..imageW, 0..imageH)
  cx: number
  cy: number
  // Bottom-center of bounding box — closer to dart tip
  tipX: number
  tipY: number
  confidence: number
}

let session: ort.InferenceSession | null = null
let warmupDone = false

export async function loadDartModel(modelPath = "/models/dart.onnx"): Promise<void> {
  if (session) return
  // WebGPU → WASM fallback
  session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ["webgpu", "wasm"],
    graphOptimizationLevel: "all",
  })
}

export function isDartModelLoaded(): boolean {
  return session !== null
}

/**
 * Preprocess: letterbox ImageData → Float32Array [1,3,640,640], NCHW, normalized 0-1
 */
function preprocess(imageData: ImageData): { tensor: ort.Tensor; scaleX: number; scaleY: number; padX: number; padY: number } {
  const { width: srcW, height: srcH } = imageData

  // Letterbox scale
  const scale = Math.min(MODEL_INPUT_SIZE / srcW, MODEL_INPUT_SIZE / srcH)
  const newW = Math.round(srcW * scale)
  const newH = Math.round(srcH * scale)
  const padX = Math.floor((MODEL_INPUT_SIZE - newW) / 2)
  const padY = Math.floor((MODEL_INPUT_SIZE - newH) / 2)

  // Draw resized image onto offscreen canvas
  const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#888888"
  ctx.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)

  // Draw resized source
  const srcCanvas = new OffscreenCanvas(srcW, srcH)
  srcCanvas.getContext("2d")!.putImageData(imageData, 0, 0)
  ctx.drawImage(srcCanvas, padX, padY, newW, newH)

  const resized = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)

  // NCHW float32 normalized
  const N = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE
  const data = new Float32Array(3 * N)
  for (let i = 0; i < N; i++) {
    data[i]         = resized.data[i * 4]     / 255  // R
    data[N + i]     = resized.data[i * 4 + 1] / 255  // G
    data[N * 2 + i] = resized.data[i * 4 + 2] / 255  // B
  }

  const tensor = new ort.Tensor("float32", data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE])
  return { tensor, scaleX: scale, scaleY: scale, padX, padY }
}

/**
 * NMS — suppress overlapping boxes
 */
function nms(boxes: number[][], scores: number[], iouThreshold: number): number[] {
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).map(v => v[1])
  const keep: number[] = []
  const suppressed = new Set<number>()

  for (const i of order) {
    if (suppressed.has(i)) continue
    keep.push(i)
    for (const j of order) {
      if (suppressed.has(j) || j === i) continue
      const iou = boxIou(boxes[i], boxes[j])
      if (iou > iouThreshold) suppressed.add(j)
    }
  }
  return keep
}

function boxIou(a: number[], b: number[]): number {
  const interX1 = Math.max(a[0], b[0]), interY1 = Math.max(a[1], b[1])
  const interX2 = Math.min(a[2], b[2]), interY2 = Math.min(a[3], b[3])
  const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1)
  const aArea = (a[2] - a[0]) * (a[3] - a[1])
  const bArea = (b[2] - b[0]) * (b[3] - b[1])
  return interArea / (aArea + bArea - interArea + 1e-6)
}

/**
 * Run dart detection on a single ImageData frame.
 * Returns detected dart positions scaled back to original image coordinates.
 */
export async function detectDarts(imageData: ImageData): Promise<DartDetection[]> {
  if (!session) return []

  const { tensor, scaleX, scaleY, padX, padY } = preprocess(imageData)

  // Warm-up run (first inference is slow)
  if (!warmupDone) {
    await session.run({ images: tensor })
    warmupDone = true
  }

  const results = await session.run({ images: tensor })

  // YOLOv8 output: [1, 4+nc, 8400] — need to check actual output name
  const outputKey = Object.keys(results)[0]
  const output = results[outputKey].data as Float32Array
  const dims = results[outputKey].dims  // [1, 4+nc, 8400]

  const numBoxes = dims[2]
  const numFields = dims[1]  // 4 + num_classes

  const dartBoxes: number[][] = []
  const dartScores: number[] = []

  for (let i = 0; i < numBoxes; i++) {
    // YOLOv8 output layout: [cx, cy, w, h, cls0, cls1, ...] for each anchor
    const cx = output[0 * numBoxes + i]
    const cy = output[1 * numBoxes + i]
    const w  = output[2 * numBoxes + i]
    const h  = output[3 * numBoxes + i]

    // Find max class score
    let maxConf = 0
    let maxCls = 0
    for (let c = 0; c < numFields - 4; c++) {
      const conf = output[(4 + c) * numBoxes + i]
      if (conf > maxConf) { maxConf = conf; maxCls = c }
    }

    if (maxCls !== DART_CLASS_INDEX || maxConf < CONF_THRESHOLD) continue

    // Convert to x1,y1,x2,y2 in model-input space
    dartBoxes.push([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])
    dartScores.push(maxConf)
  }

  if (!dartBoxes.length) return []

  const kept = nms(dartBoxes, dartScores, IOU_THRESHOLD)

  return kept.map(idx => {
    const [x1, y1, x2, y2] = dartBoxes[idx]
    // Undo letterbox padding and scale back to original image coords
    const origCx = ((x1 + x2) / 2 - padX) / scaleX
    const origCy = ((y1 + y2) / 2 - padY) / scaleY
    // Tip: bottom-center of bbox (dart tip is at the lower/entry end of the visible dart)
    const origTipX = ((x1 + x2) / 2 - padX) / scaleX
    const origTipY = (y2 - padY) / scaleY

    return {
      cx: origCx,
      cy: origCy,
      tipX: origTipX,
      tipY: origTipY,
      confidence: dartScores[idx],
    }
  })
}
