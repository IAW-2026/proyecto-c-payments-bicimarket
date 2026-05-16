import { Icons } from "@/lib/icons"

interface DeltaProps {
  value: number
  type?: "pct" | "abs"
}

function getDelta(value: number) {
  if (value > 0) return { dir: "up" as const, Icon: Icons.Trend }
  if (value < 0) return { dir: "down" as const, Icon: Icons.TrendDown }
  return { dir: "flat" as const, Icon: Icons.Minus }
}

function formatValue(value: number, type: "pct" | "abs") {
  if (value === 0 && type === "pct") return "0%"
  if (value === 0 && type === "abs") return "0"
  const sign = value > 0 ? "+" : ""
  const formatted = type === "pct" ? `${value.toFixed(1)}%` : `${value}`
  return `${sign}${formatted}`
}

export function Delta({ value, type = "pct" }: DeltaProps) {
  const { dir, Icon } = getDelta(value)
  return (
    <span className={`delta ${dir}`}>
      <Icon />
      {formatValue(value, type)}
    </span>
  )
}
