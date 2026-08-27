// Дижитал зум — камерын жинхэнэ frame-ээс төв хэсгийг crop хийж canvas руу татна.
// zoom=1 үед хуучин drawImage(video,0,0,w,h)-тэй яг ижил гарна (crop хийхгүй).
export function captureZoomedFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  zoom: number,
): ImageData | null {
  if (video.readyState < 2) return null
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const vw = video.videoWidth || width
  const vh = video.videoHeight || height
  const z = Math.max(1, zoom)
  const cw = vw / z
  const ch = vh / z
  const sx = (vw - cw) / 2
  const sy = (vh - ch) / 2
  ctx.drawImage(video, sx, sy, cw, ch, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}
