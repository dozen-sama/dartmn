import { Metadata } from "next"
import { NewTournamentChoice } from "./NewTournamentChoice"

export const metadata: Metadata = { title: "Тэмцээн үүсгэх" }

export default function NewTournamentPage() {
  return <NewTournamentChoice />
}
