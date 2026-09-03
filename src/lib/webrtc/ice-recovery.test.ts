// Node built-in test runner ашиглана (`node --test`) — репод тестийн
// framework алга тул шинээр нэмээгүй, зөвхөн энэ pure recovery-шийдвэрийн
// логикийг баталгаажуулна. RTCPeerConnection/timer fake хийхгүй — зөвхөн
// цэвэр функцуудыг шалгана.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  shouldInitiateRecovery,
  shouldAttemptIceRestart,
  shouldRebuildAfterRecoveryTimeout,
  canAttemptRebuild,
} from "./ice-recovery.ts"

// A. deterministic recovery initiator — яг НЭГ тал л эзэмшинэ
test("exactly one side of a pair is the recovery initiator", () => {
  const pairs: [string, string][] = [
    ["a1", "b2"],
    ["user-123", "user-456"],
    ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"],
    ["zeta", "alpha"],
  ]
  for (const [x, y] of pairs) {
    const xInit = shouldInitiateRecovery(x, y)
    const yInit = shouldInitiateRecovery(y, x)
    assert.notEqual(xInit, yInit)
  }
})

// B. connected/completed -> сэргээлт хэзээ ч санаачлагдахгүй
test("connected/completed never authorize an ICE restart", () => {
  assert.equal(shouldAttemptIceRestart("connected", true), false)
  assert.equal(shouldAttemptIceRestart("completed", true), false)
})

// C. transient disconnected -> grace timer шатахаас өмнө сэргэвэл restart-гүй.
// (Hook grace timer шатах мөчид pc.iceConnectionState-г шууд шалгадаг тул
// "аль хэдийн connected болсон" нөхцөл яг connected input-оор илэрхийлэгдэнэ.)
test("recovered-before-grace-fires state does not authorize restart", () => {
  assert.equal(shouldAttemptIceRestart("connected", true), false)
})

// D. persistent disconnected -> зөвхөн эзэмшигч тал л restart хийнэ
test("still-disconnected at grace expiry restarts only for the initiator", () => {
  assert.equal(shouldAttemptIceRestart("disconnected", true), true)
  assert.equal(shouldAttemptIceRestart("disconnected", false), false)
})

// E. failed -> эзэмшигч тал шууд (grace хүлээхгүйгээр) restart хийнэ
test("failed authorizes an immediate restart only for the initiator", () => {
  assert.equal(shouldAttemptIceRestart("failed", true), true)
  assert.equal(shouldAttemptIceRestart("failed", false), false)
})

// F. non-initiator хэзээ ч бие даан restart хийхгүй
test("non-initiator never restarts regardless of ICE state", () => {
  for (const state of ["disconnected", "failed", "checking", "new"] as const) {
    assert.equal(shouldAttemptIceRestart(state, false), false)
  }
})

// checking/new -> бие даан сэргээлт эхлүүлэхгүй (initiator эсэхээс үл хамааран)
test("checking/new never authorize a restart, even for the initiator", () => {
  assert.equal(shouldAttemptIceRestart("checking", true), false)
  assert.equal(shouldAttemptIceRestart("new", true), false)
})

// H (шийдвэрийн хэсэг). bounded timeout дараа сэргэсэн бол rebuild хийхгүй,
// хэвээр эвдэрхий бол rebuild хийнэ.
test("rebuild decision: recovered state does not rebuild", () => {
  assert.equal(shouldRebuildAfterRecoveryTimeout("connected"), false)
  assert.equal(shouldRebuildAfterRecoveryTimeout("completed"), false)
})
test("rebuild decision: still-broken state rebuilds", () => {
  assert.equal(shouldRebuildAfterRecoveryTimeout("disconnected"), true)
  assert.equal(shouldRebuildAfterRecoveryTimeout("failed"), true)
  assert.equal(shouldRebuildAfterRecoveryTimeout("checking"), true)
})

// I. rebuild нэг episode-д ганцаас хэтрэхгүй (endless loop-оос сэргийлэлт)
test("rebuild is bounded to one attempt per failure episode", () => {
  assert.equal(canAttemptRebuild(0), true)
  assert.equal(canAttemptRebuild(1), false)
  assert.equal(canAttemptRebuild(2), false)
})
