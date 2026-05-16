"use client"

import { Icons } from "@/lib/icons"

interface PaginatorProps {
  page: number
  total: number
  pageSize: number
  hasMore: boolean
  onPrev: () => void
  onNext: () => void
}

export function Paginator({ page, total, pageSize, hasMore, onPrev, onNext }: PaginatorProps) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="paginator">
      <div className="row gap-3">
        <span>
          Mostrando <span className="tnum">{from}–{to}</span> de{" "}
          <span className="tnum">{total}</span>
        </span>
      </div>
      <div className="page-arrows">
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={onPrev}>
          <Icons.Chevron style={{ transform: "rotate(180deg)" }} /> Anterior
        </button>
        <button className="btn btn-secondary btn-sm" disabled={!hasMore} onClick={onNext}>
          Siguiente <Icons.Chevron />
        </button>
      </div>
    </div>
  )
}
