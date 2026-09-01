import { test } from "node:test"
import assert from "node:assert/strict"
import { canHandleMatched, shouldReconcile, classifyRoomPlayersInsert } from "./session-guard.ts"

// canHandleMatched is the single gate all three "we have a room" sources
// (HTTP /join response, room_players realtime INSERT, reconciliation read)
// call through via handleMatched — so these cases hold regardless of which
// of the three produced the (roomId, mySession) pair. Letters map to the
// scenarios from the matchmaking reliability audit:
//   A: HTTP join response reports matched -> navigate
//   B: room_players realtime INSERT arrives -> navigate
//   C: realtime + HTTP both observe a match in the same session -> once
//   D: reconciliation + realtime both observe a match in the same session -> once
//   E: stale session from a cancelled/unmounted search -> blocked
//   F: a newer search superseded an older in-flight callback -> blocked

// A / B: subscription ready, first source to report a match in this session acts
test("same session, not yet navigated -> allowed", () => {
  assert.equal(canHandleMatched(1, 1, false), true)
})

// C / D: two sources (e.g. realtime + HTTP, or reconciliation + realtime) both
// observe "matched" in the same session — only the first one to call navigates
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

// shouldReconcile gates the one-shot room_players catch-up read itself
// (distinct from canHandleMatched, which gates what happens with its result).

test("neither channel subscribed nor search-start timestamp known yet -> not yet", () => {
  assert.equal(shouldReconcile(false, null, false), false)
})

test("subscribed but join response hasn't returned searchStartedAt yet -> not yet", () => {
  assert.equal(shouldReconcile(true, null, false), false)
})

test("join resolved first but channel not SUBSCRIBED yet -> not yet", () => {
  assert.equal(shouldReconcile(false, "2026-09-01T03:55:06.000Z", false), false)
})

test("both landed -> reconcile now", () => {
  assert.equal(shouldReconcile(true, "2026-09-01T03:55:06.000Z", false), true)
})

// D: reconciliation must not re-run once it already has (e.g. SUBSCRIBED firing
// again, or the join response resolving after the channel-triggered read already ran)
test("already reconciled -> never again this session", () => {
  assert.equal(shouldReconcile(true, "2026-09-01T03:55:06.000Z", true), false)
})

// classifyRoomPlayersInsert is the shared invariant the LIVE room_players
// INSERT path and the reconciliation SELECT both apply, so a room_players
// row is only ever treated as "this match" when it's genuinely part of the
// current matchmaking attempt — not an unrelated invite, and not a stale
// row surviving from an earlier abandoned search.

test("unrelated non-random room INSERT -> ignored", () => {
  assert.equal(
    classifyRoomPlayersInsert("invite", "2026-09-01T03:55:10.000Z", "2026-09-01T03:55:00.000Z"),
    "reject",
  )
})

test("random room, but row predates this search's start -> ignored (stale)", () => {
  assert.equal(
    classifyRoomPlayersInsert("random", "2026-09-01T03:54:00.000Z", "2026-09-01T03:55:00.000Z"),
    "reject",
  )
})

test("random room created for this search -> accepted", () => {
  assert.equal(
    classifyRoomPlayersInsert("random", "2026-09-01T03:55:10.000Z", "2026-09-01T03:55:00.000Z"),
    "accept",
  )
})

// The INSERT can race ahead of the /join response that supplies
// searchStartedAt. It must be held (not dropped, not acted on) until the
// timestamp is known, then re-evaluated with the exact same rule.
test("INSERT arrives before searchStartedAt is known -> held, not dropped or navigated to", () => {
  assert.equal(classifyRoomPlayersInsert("random", "2026-09-01T03:55:10.000Z", null), "pending")
})

test("held INSERT is safely accepted once searchStartedAt confirms it belongs to this search", () => {
  assert.equal(
    classifyRoomPlayersInsert("random", "2026-09-01T03:55:10.000Z", "2026-09-01T03:55:00.000Z"),
    "accept",
  )
})

test("held INSERT is safely rejected once searchStartedAt reveals it predates this search", () => {
  // e.g. an unrelated random-mode room the player was already in before this search began
  assert.equal(
    classifyRoomPlayersInsert("random", "2026-09-01T03:55:10.000Z", "2026-09-01T03:56:00.000Z"),
    "reject",
  )
})

// Simulates MatchmakingSection's actual reconciliation wiring: tryReconcile()
// is invoked from BOTH the SUBSCRIBED callback and after the join response
// resolves, each call re-checking shouldReconcile against current state.
// This proves the real dual-trigger pattern — not just the pure predicate —
// is order-independent and runs exactly once, covering the ordering the
// original single-trigger (SUBSCRIBED-only) implementation would have missed.
function simulateReconciliationTrigger() {
  let subscribed = false
  let searchStartedAt: string | null = null
  let reconciled = false
  let runCount = 0
  function tryReconcile() {
    if (!shouldReconcile(subscribed, searchStartedAt, reconciled)) return
    reconciled = true
    runCount++
  }
  return {
    onSubscribed() { subscribed = true; tryReconcile() },
    onJoinResponse(ts: string) { searchStartedAt = ts; tryReconcile() },
    runCount: () => runCount,
  }
}

// A: SUBSCRIBED fires first, /join response provides searchStartedAt later
test("SUBSCRIBED before HTTP response -> reconciliation still runs", () => {
  const sim = simulateReconciliationTrigger()
  sim.onSubscribed()
  assert.equal(sim.runCount(), 0, "must not run before searchStartedAt is known")
  sim.onJoinResponse("2026-09-01T03:55:06.000Z")
  assert.equal(sim.runCount(), 1)
})

// B: /join response (and searchStartedAt) arrives first, SUBSCRIBED later
test("HTTP response before SUBSCRIBED -> reconciliation still runs", () => {
  const sim = simulateReconciliationTrigger()
  sim.onJoinResponse("2026-09-01T03:55:06.000Z")
  assert.equal(sim.runCount(), 0, "must not run before the channel is live")
  sim.onSubscribed()
  assert.equal(sim.runCount(), 1)
})

// C: both triggers can fire more than once each (e.g. a stray repeated
// SUBSCRIBED status) — must still execute the underlying read only once
test("reconciliation executes exactly once regardless of how many times either trigger fires", () => {
  const sim = simulateReconciliationTrigger()
  sim.onSubscribed()
  sim.onJoinResponse("2026-09-01T03:55:06.000Z")
  sim.onSubscribed()
  sim.onJoinResponse("2026-09-01T03:55:06.000Z")
  assert.equal(sim.runCount(), 1)
})
