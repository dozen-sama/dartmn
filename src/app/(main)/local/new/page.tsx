import { Metadata } from "next"
import { SetupWizard } from "./SetupWizard"

export const metadata: Metadata = { title: "Тоглолт үүсгэх" }

export default function NewLocalGamePage() {
  return <SetupWizard />
}
