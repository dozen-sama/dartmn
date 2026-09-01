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
