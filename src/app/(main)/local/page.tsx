import { Metadata } from "next"
import { LocalHub } from "./LocalHub"

export const metadata: Metadata = { title: "Local тоглолт" }

export default function LocalPage() {
  return <LocalHub />
}
