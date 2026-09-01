import { test } from "node:test"
import assert from "node:assert/strict"
import { canHandleMatched } from "./session-guard.ts"

// A: subscription ready, later realtime event arrives in the same session — first call acts
test("same session, not yet navigated -> allowed", () => {
  assert.equal(canHandleMatched(1, 1, false), true)
})

// D: realtime event and reconciliation both observe matched in the same session — only the first acts
test("same session, already navigated -> blocked (no duplicate navigation)", () => {
  assert.equal(canHandleMatched(1, 1, true), false)
})

// E: user cancels (or component unmounts) before an in-flight callback (join response,
// realtime event, or reconciliation read) resolves — session was bumped, callback is stale
test("session bumped after callback started (cancel/unmount) -> blocked", () => {
  assert.equal(canHandleMatched(2, 1, false), false)
})

// F: a new search starts after an old one's async work is still in flight —
// the old callback's captured session no longer matches the current one
test("newer search superseded an older in-flight callback -> blocked", () => {
  assert.equal(canHandleMatched(5, 3, false), false)
})

// Stale session check is authoritative even if (hypothetically) alreadyNavigated were still false
test("stale session blocked regardless of navigated flag", () => {
  assert.equal(canHandleMatched(2, 1, true), false)
  assert.equal(canHandleMatched(2, 1, false), false)
})
