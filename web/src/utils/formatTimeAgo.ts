/** Human-readable "how long ago" label — 'just now', '5m ago', '3h ago', '2d ago'. */
export function formatTimeAgo(date: Date): string {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.round(diffH / 24)}d ago`
}
