import { Metadata } from "next"
import { TogetherGame } from "./TogetherGame"

export const metadata: Metadata = { title: "Хамтдаа тоглох" }

export default function TogetherPage() {
  return <TogetherGame />
}
