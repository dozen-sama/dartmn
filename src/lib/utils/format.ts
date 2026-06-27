export function formatCurrency(amount: number, currency = "MNT"): string {
  return new Intl.NumberFormat("mn-MN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}.${mm}.${dd}`
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr))
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Сая"
  if (diffMins < 60) return `${diffMins} минутын өмнө`
  if (diffHours < 24) return `${diffHours} цагийн өмнө`
  if (diffDays < 7) return `${diffDays} өдрийн өмнө`
  return formatDate(dateStr)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("mn-MN").format(num)
}

export function formatAverage(avg: number): string {
  return avg.toFixed(2)
}

export function formatPercentage(pct: number): string {
  return `${(pct * 100).toFixed(1)}%`
}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
