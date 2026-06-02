import { Metadata } from "next"
import { Scoreboard } from "./Scoreboard"

export const metadata: Metadata = { title: "Scoreboard" }

export default function MatchPage() {
  return <Scoreboard />
}
