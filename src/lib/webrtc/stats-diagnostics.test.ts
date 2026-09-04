// Node built-in test runner ашиглана (`node --test`) — repo-д тестийн
// framework алга тул шинээр нэмээгүй, зөвхөн энэ pure camera-stats
// оношлогооны логикийг баталгаажуулна. RTCPeerConnection/getStats() fake
// хийхгүй — зөвхөн цэвэр функцуудыг шалгана.
import { test } from "node:test"
import assert from "node:assert/strict"
import { computeDiagnosticDeltas, findSelectedCandidatePairId, type DiagnosticSample } from "./stats-diagnostics.ts"

function sample(overrides: Partial<DiagnosticSample>): DiagnosticSample {
  return {
    ts: 0,
    outboundRtpId: "out-1",
    bytesSent: 0,
    framesEncoded: 0,
    inboundRtpId: "in-1",
    bytesReceived: 0,
    framesDecoded: 0,
    freezeCount: 0,
    ...overrides,
  }
}

// A. эхний sample (prev байхгүй) -> бүх delta "?" (undefined)
test("first sample has no deltas", () => {
  const curr = sample({ ts: 3000, bytesSent: 100_000, framesEncoded: 90 })
  const deltas = computeDiagnosticDeltas(undefined, curr)
  assert.deepEqual(deltas, {})
})

// B. ижил RTP id-тай хэвийн cumulative counter -> зөв эерэг delta
test("same PC, same RTP id: normal cumulative counters produce positive deltas", () => {
  const prev = sample({ ts: 0, bytesSent: 0, framesEncoded: 0, bytesReceived: 0, framesDecoded: 0, freezeCount: 0 })
  const curr = sample({
    ts: 3000, // 3s
    bytesSent: 300_000, // 300,000*8/3/1000 = 800 kbps
    framesEncoded: 90, // 30 fps
    bytesReceived: 150_000, // 400 kbps
    framesDecoded: 81, // 27 fps
    freezeCount: 2,
  })
  const deltas = computeDiagnosticDeltas(prev, curr)
  assert.equal(deltas.sendKbps, 800)
  assert.equal(deltas.sendFps, 30)
  assert.equal(deltas.recvKbps, 400)
  assert.equal(deltas.recvFps, 27)
  assert.equal(deltas.freezeDelta, 2)
})

// C. rebuilt PC (WeakMap-ийн key солигдсоны адил) -> prev undefined -> delta байхгүй,
// сөрөг тоо хэзээ ч гарахгүй
test("new PC (no prior snapshot) never produces negative deltas", () => {
  // Хуучин pc дээр их хэмжээний bytes хуримтлагдсан байсан ч шинэ pc-ийн
  // snapshot түүнийг огт мэдэхгүй тул prev=undefined -> {} буцна.
  const curr = sample({ ts: 3000, bytesSent: 500, framesEncoded: 1, bytesReceived: 200, framesDecoded: 1, freezeCount: 0 })
  const deltas = computeDiagnosticDeltas(undefined, curr)
  assert.deepEqual(deltas, {})
  assert.equal("sendKbps" in deltas, false)
  assert.equal("sendFps" in deltas, false)
})

// D. RTP stat id өөрчлөгдсөн (SSRC/renegotiation, pc адилхан) -> зөвхөн тухайн
// чиглэл л baseline reset хийнэ, нөгөө чиглэл хэвийн үргэлжилнэ
test("outbound RTP id change resets only the outbound direction", () => {
  const prev = sample({ ts: 0, outboundRtpId: "out-1", bytesSent: 0, framesEncoded: 0, inboundRtpId: "in-1", bytesReceived: 0, framesDecoded: 0, freezeCount: 0 })
  const curr = sample({
    ts: 2000,
    outboundRtpId: "out-2", // өөрчлөгдсөн — шинэ RTP stream
    bytesSent: 999_999, // хуучин outbound-той харьцуулж болохгүй тул үл тооцно
    framesEncoded: 999,
    inboundRtpId: "in-1", // хэвээр — inbound хэвийн үргэлжилнэ
    bytesReceived: 50_000, // 200 kbps over 2s
    framesDecoded: 60, // 30 fps over 2s
    freezeCount: 1,
  })
  const deltas = computeDiagnosticDeltas(prev, curr)
  assert.equal(deltas.sendKbps, undefined)
  assert.equal(deltas.sendFps, undefined)
  assert.equal(deltas.recvKbps, 200)
  assert.equal(deltas.recvFps, 30)
  assert.equal(deltas.freezeDelta, 1)
})

test("inbound RTP id change resets only the inbound direction", () => {
  const prev = sample({ ts: 0, outboundRtpId: "out-1", bytesSent: 0, framesEncoded: 0, inboundRtpId: "in-1", bytesReceived: 0, framesDecoded: 0, freezeCount: 5 })
  const curr = sample({
    ts: 2000,
    outboundRtpId: "out-1",
    bytesSent: 40_000, // 160 kbps over 2s
    framesEncoded: 40, // 20 fps over 2s
    inboundRtpId: "in-2", // өөрчлөгдсөн
    bytesReceived: 999_999,
    framesDecoded: 999,
    freezeCount: 0, // хуучин in-1-тэй харьцуулбал "ухарсан" мэт боловч id өөр тул огт үл тооцно
  })
  const deltas = computeDiagnosticDeltas(prev, curr)
  assert.equal(deltas.sendKbps, 160)
  assert.equal(deltas.sendFps, 20)
  assert.equal(deltas.recvKbps, undefined)
  assert.equal(deltas.recvFps, undefined)
  assert.equal(deltas.freezeDelta, undefined)
})

// E. ижил RTP id хэвээр байхад cumulative тоолуур ухарсан (аюулгүй байдлын
// нэмэлт хамгаалалт — практикт тохиолдохгүй ч) -> "?" (undefined), 0 биш,
// сөрөг тоо ч биш
test("counter regression on the same RTP id yields undefined, never negative or zero", () => {
  const prev = sample({ ts: 0, bytesSent: 500_000, framesEncoded: 150, bytesReceived: 300_000, framesDecoded: 120, freezeCount: 10 })
  const curr = sample({
    ts: 1000,
    bytesSent: 100_000, // ухарсан
    framesEncoded: 50, // ухарсан
    bytesReceived: 100_000, // ухарсан
    framesDecoded: 40, // ухарсан
    freezeCount: 3, // ухарсан
  })
  const deltas = computeDiagnosticDeltas(prev, curr)
  assert.equal(deltas.sendKbps, undefined)
  assert.equal(deltas.sendFps, undefined)
  assert.equal(deltas.recvKbps, undefined)
  assert.equal(deltas.recvFps, undefined)
  assert.equal(deltas.freezeDelta, undefined)
})

// F. zero/negative dt (clock жигдрэлгүй edge case) -> delta тооцохгүй
test("non-positive elapsed time yields no deltas", () => {
  const prev = sample({ ts: 1000, bytesSent: 0, framesEncoded: 0 })
  const curr = sample({ ts: 1000, bytesSent: 1000, framesEncoded: 10 })
  assert.deepEqual(computeDiagnosticDeltas(prev, curr), {})
})

// --- findSelectedCandidatePairId ---

// G. transport.selectedCandidatePairId байвал үүнийг nominated+succeeded-ээс
// ДЭЭГҮҮР сонгоно
test("selectedCandidatePairId takes precedence over nominated+succeeded fallback", () => {
  const stats = [
    { type: "transport", id: "t1", selectedCandidatePairId: "pair-active" },
    // "stale" nominated+succeeded pair — идэвхгүй ч гэсэн хуучин нэр
    // хэвээрээ тэмдэглэгдсэн байж болно (ICE restart-ийн жинхэнэ тохиолдол)
    { type: "candidate-pair", id: "pair-stale", state: "succeeded", nominated: true },
    { type: "candidate-pair", id: "pair-active", state: "succeeded", nominated: true },
  ]
  assert.equal(findSelectedCandidatePairId(stats), "pair-active")
})

// H. transport stat байхгүй/selectedCandidatePairId алга бол nominated+succeeded
// fallback ажиллана
test("falls back to nominated+succeeded when no transport.selectedCandidatePairId", () => {
  const stats = [
    { type: "candidate-pair", id: "pair-a", state: "failed", nominated: true },
    { type: "candidate-pair", id: "pair-b", state: "succeeded", nominated: true },
  ]
  assert.equal(findSelectedCandidatePairId(stats), "pair-b")
})

// I. юу ч олдохгүй бол undefined (candidate талбар лог хийхгүй, throw ч хийхгүй)
test("returns undefined when nothing matches", () => {
  const stats = [{ type: "codec", id: "c1" }]
  assert.equal(findSelectedCandidatePairId(stats), undefined)
})
