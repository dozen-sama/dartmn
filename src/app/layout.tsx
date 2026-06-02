import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors theme="dark" position="top-right" />
      </body>
    </html>
  )
}
