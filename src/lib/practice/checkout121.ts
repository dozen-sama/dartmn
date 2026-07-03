// 121 Checkout — 121-ээс эхэлж дараалсан checkout-уудыг (121, 122, 123...) 3 visit-ийн
// дотор хаана. Амжилттай бол дараагийн тоо руу, 3 дахь visit-д ч амжилтгүй бол 121-ээс дахин.
import { classifyTurn } from "@/lib/local-game/checkouts"

export interface Checkout121State {
  target: number
  remaining: number
  visitsUsed: number
  streak: number
  bestStreak: number
  attempts: number
  status: "playing" | "success" | "fail"
}

export function initCheckout121State(): Checkout121State {
  return { target: 121, remaining: 121, visitsUsed: 0, streak: 0, bestStreak: 0, attempts: 0, status: "playing" }
}

export function applyCheckout121Visit(state: Checkout121State, points: number): Checkout121State {
  const outcome = classifyTurn(state.remaining, points, { doubleOut: true })

  if (outcome.type === "checkout") {
    const streak = state.streak + 1
    const target = state.target + 1
    return {
      target,
      remaining: target,
      visitsUsed: 0,
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      attempts: state.attempts,
      status: "success",
    }
  }

  const visitsUsed = state.visitsUsed + 1
  if (visitsUsed >= 3) {
    return {
      target: 121,
      remaining: 121,
      visitsUsed: 0,
      streak: 0,
      bestStreak: state.bestStreak,
      attempts: state.attempts + 1,
      status: "fail",
    }
  }

  return {
    target: state.target,
    remaining: outcome.remaining,
    visitsUsed,
    streak: state.streak,
    bestStreak: state.bestStreak,
    attempts: state.attempts,
    status: "playing",
  }
}
