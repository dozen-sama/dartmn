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

export async function detectDarts(imageData: ImageData): Promise<DartDetection[]> {
  if (!session) return []

  const { tensor, scale, padX, padY } = await preprocess(imageData)

  if (!warmupDone) {
    await session.run({ images: tensor })
    warmupDone = true
  }

  const results = await session.run({ images: tensor })
  const outputKey = Object.keys(results)[0]
  const output = results[outputKey].data as Float32Array
  const dims = results[outputKey].dims  // [1, 11, 8400]
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
