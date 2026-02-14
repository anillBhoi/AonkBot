export function formatCompactNumber(value?: number): string {
  if (!value) return "0"

  if (value >= 1_000_000_000)
    return (value / 1_000_000_000).toFixed(2) + "B"
  if (value >= 1_000_000)
    return (value / 1_000_000).toFixed(2) + "M"
  if (value >= 1_000)
    return (value / 1_000).toFixed(2) + "K"

  return value.toFixed(2)
}

export function formatChange(value?: number): string {
  if (value === undefined || value === null) return "0.00%"

  const formatted = Number(value).toFixed(2)
  return value >= 0 ? `+${formatted}%` : `${formatted}%`
}
