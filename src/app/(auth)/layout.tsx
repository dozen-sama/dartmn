import { Target } from "lucide-react"
import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary glow-primary">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">
            Dart<span className="text-primary">MN</span>
          </span>
        </Link>
        {children}
      </div>
    </div>
  )
}
