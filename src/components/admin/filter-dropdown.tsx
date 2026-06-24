"use client"

import { useRef, useState, useEffect, useCallback } from "react"
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
  const [focusIdx, setFocusIdx] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setFocusIdx(-1)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [close])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault()
        setOpen(true)
        setFocusIdx(0)
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setFocusIdx((prev) => (prev < options.length - 1 ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setFocusIdx((prev) => (prev > 0 ? prev - 1 : options.length - 1))
        break
      case "Enter":
      case " ":
        e.preventDefault()
        if (focusIdx >= 0 && focusIdx < options.length) {
          onChange(options[focusIdx].value)
          close()
        }
        break
      case "Escape":
        e.preventDefault()
        close()
        break
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }} onKeyDown={handleKeyDown}>
      <button
        className="filter-chip"
        onClick={() => setOpen((c) => !c)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${options.find((o) => o.value === value)?.label ?? label}`}
        type="button"
      >
        {icon}{label} <Icons.Down />
      </button>
      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={label}
          style={{
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
          }}
        >
          {options.map((opt, i) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => { onChange(opt.value); close() }}
              onMouseEnter={() => setFocusIdx(i)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderRadius: 6,
                fontSize: 13,
                background: value === opt.value ? "var(--accent)" : focusIdx === i ? "var(--muted)" : "transparent",
                fontWeight: value === opt.value ? 600 : 400,
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
