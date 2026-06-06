import { cn } from "@/lib/utils"

interface DartSelectorProps {
  value: number
  onChange: (n: number) => void
  label?: string
  className?: string
}

export function DartSelector({ value, onChange, label, className }: DartSelectorProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <p className="text-[11px] text-muted-foreground">{label}</p>}
      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border-2 text-sm font-bold transition-all",
              value === n
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:border-border"
            )}
          >
            <span className="text-base">{"🎯".repeat(n)}</span>
            <span>{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
