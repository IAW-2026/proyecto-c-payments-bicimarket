"use client"

import { useRef, useState, useEffect } from "react"
import { Icons } from "@/lib/icons"

interface FilterOption {
  label: string
  value: string
}

interface FilterDropdownProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  icon?: React.ReactNode
}

export function FilterDropdown({ label, value, options, onChange, icon }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <span className="filter-chip" onClick={() => setOpen((c) => !c)}>
        {icon}{label} <Icons.Down />
      </span>
      {open && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          zIndex: 50,
          marginTop: 4,
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 4px 16px oklch(0 0 0 / 20%)",
          minWidth: 180,
          padding: 4,
        }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderRadius: 6,
                fontSize: 13,
                background: value === opt.value ? "var(--accent)" : "transparent",
                fontWeight: value === opt.value ? 600 : 400,
              }}
              onMouseEnter={(e) => { if (value !== opt.value) e.currentTarget.style.background = "var(--muted)" }}
              onMouseLeave={(e) => { if (value !== opt.value) e.currentTarget.style.background = "transparent" }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
