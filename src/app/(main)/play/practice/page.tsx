import { Metadata } from "next"
import { PracticeHub } from "./PracticeHub"

export const metadata: Metadata = { title: "Бэлтгэл тоглолт" }

export default function PracticePage() {
  return <PracticeHub />
}
