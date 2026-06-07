import type { Metadata, Viewport } from "next"
import { Inter, Oswald, Russo_One, Montserrat, Rubik, Exo_2 } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

// Бүх фонт латин + кирилл (монгол) дэмжинэ
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" })
const oswald = Oswald({ subsets: ["latin", "cyrillic"], variable: "--font-oswald" })
const russo = Russo_One({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-russo" })
const montserrat = Montserrat({ subsets: ["latin", "cyrillic"], variable: "--font-montserrat" })
const rubik = Rubik({ subsets: ["latin", "cyrillic"], variable: "--font-rubik" })
const exo2 = Exo_2({ subsets: ["latin", "cyrillic"], variable: "--font-exo2" })

const fontVars = [inter, oswald, russo, montserrat, rubik, exo2].map((f) => f.variable).join(" ")

export const metadata: Metadata = {
  title: {
    default: "DartMN — Монголын Дартсын Платформ",
    template: "%s | DartMN",
  },
  description: "Монголын дартсын тоглогчид, клубууд болон тэмцээнүүдийг нэгтгэсэн платформ",
  keywords: ["дартс", "монгол", "тэмцээн", "лиг", "дартс клуб", "DartMN"],
  authors: [{ name: "DartMN" }],
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="mn" className="dark">
      <body className={`${fontVars} font-sans antialiased`}>
        {children}
        <Toaster richColors theme="dark" position="top-right" />
      </body>
    </html>
  )
}
