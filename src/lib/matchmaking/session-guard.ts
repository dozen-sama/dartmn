// A matchmaking search can learn "you're matched" from three independent
// sources racing each other: the synchronous /api/matchmaking/join response,
// a realtime postgres_changes UPDATE event, and a one-time reconciliation
// read performed once the realtime channel reaches SUBSCRIBED (the missed-
// event safety net). This guard is the single rule all three must pass
// before acting, so exactly one of them navigates, and none of them can act
// on behalf of a search that's since been cancelled or superseded by a new one.
export function canHandleMatched(
  currentSession: number,
  callbackSession: number,
  alreadyNavigated: boolean,
): boolean {
  if (currentSession !== callbackSession) return false // stale: cancelled, unmounted, or superseded by a newer search
  if (alreadyNavigated) return false // this session already navigated once
  return true
}

// The one-time room_players reconciliation read (the catch-up for a match
// that happened before the realtime channel was live) must not run before
// two independent, differently-timed async events have both landed — the
// channel reaching SUBSCRIBED, and the join response supplying this
// search's own server-clock start timestamp — and must not run twice if
// both land close together. Kept separate from canHandleMatched: this
// gates whether the reconciliation *read* happens at all, while
// canHandleMatched gates whether its *result* is allowed to navigate.
export function shouldReconcile(
  subscribed: boolean,
  searchStartedAt: string | null,
  alreadyReconciled: boolean,
): boolean {
  if (alreadyReconciled) return false
  return subscribed && searchStartedAt !== null
}

// A live room_players INSERT for the current player is not on its own proof
// that it belongs to the CURRENT matchmaking attempt: the same player could
// receive a room_players row from an unrelated source (e.g. accepting a
// friend invite in another tab) while a search is in progress, and even a
// genuine matchmaking room's row can in principle race ahead of the /join
// response that tells the client when this search actually started. Both
// the live path and the reconciliation path must apply the same invariant —
// this is that shared rule, factored out so it can't drift between them:
//   - the room the row belongs to must be matchmaking-created ('random')
//   - the row's own joined_at must not predate this search's start
// searchStartedAt being unknown yet is NOT a rejection — it means the
// event must be held and re-evaluated once it becomes known, not dropped
// and not acted on speculatively. Callers distinguish "pending" from
// "reject" to implement that without losing the event.
export type RoomPlayersInsertVerdict = "accept" | "reject" | "pending"

export function classifyRoomPlayersInsert(
  startMethod: string | null,
  joinedAt: string,
  searchStartedAt: string | null,
): RoomPlayersInsertVerdict {
  if (startMethod !== "random") return "reject" // not a matchmaking room at all
  if (searchStartedAt === null) return "pending" // matchmaking room, but can't yet tell which attempt
  return joinedAt >= searchStartedAt ? "accept" : "reject"
}
