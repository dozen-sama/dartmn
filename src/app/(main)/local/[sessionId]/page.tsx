import { Metadata } from "next"
import { SessionView } from "./SessionView"

export const metadata: Metadata = { title: "Тоглолт" }

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return <SessionView />
}
