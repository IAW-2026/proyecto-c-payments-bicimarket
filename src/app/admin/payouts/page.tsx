"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { Paginator } from "@/components/admin/paginator"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { downloadCsv } from "@/lib/csv"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePayouts } from "@/hooks/use-settlements"
import { useToast } from "@/hooks/use-toast"
import type { PayoutFilters } from "@/types/filters"

function copy(text: string) { navigator.clipboard.writeText(text) }

export default function PayoutsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState("queue")
  const [sortKey, setSortKey] = useState("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [searchQ, setSearchQ] = useState("")
  const [dateRange, setDateRange] = useState("")

  const dateFrom = useMemo(() => {
    if (!dateRange) return undefined
    const now = Date.now()
    const map: Record<string, number> = { today: 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365 }
    const days = map[dateRange]
    return days !== undefined ? new Date(now - days * 86400000).toISOString() : undefined
  }, [dateRange])

  const filters = useMemo<PayoutFilters>(() => ({ page, limit: 20, q: searchQ || undefined, ...(dateFrom ? { from: dateFrom } : {}) }), [page, searchQ, dateFrom])

  const payoutsQuery = usePayouts(filters)

  const payouts = payoutsQuery.data?.data ?? []
  const pagination = payoutsQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(d => d === "asc" ? "desc" : "asc") }
    else { setSortKey(key); setSortDir("desc") }
  }

  const sortIcon = (key: string) => {
    if (sortKey !== key) return <Icons.Down style={{ opacity: 0.25 }} />
    return <Icons.Down style={{ transform: sortDir === "asc" ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === payouts.length) setSelected(new Set())
    else setSelected(new Set(payouts.map((p) => p.id)))
  }

  const failed = payouts.filter((p) => p.status === "failed" || p.status === "manual_review")
  const scheduled = payouts.filter((p) => p.status === "pending")
  const inProgress = payouts.filter((p) => p.status === "in_progress")
  const completed = payouts.filter((p) => p.status === "completed")

  const displayedPayouts = tab === "attention" ? failed : tab === "history" ? completed : [...scheduled, ...inProgress]

  const sortedPayouts = useMemo(() => {
    if (!sortKey) return displayedPayouts
    return [...displayedPayouts].sort((a, b) => {
      const va = sortKey === "amount" ? (a.settlement?.gross_amount_cents ?? 0) : a.created_at
      const vb = sortKey === "amount" ? (b.settlement?.gross_amount_cents ?? 0) : b.created_at
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [displayedPayouts, sortKey, sortDir])

  const totals = useMemo(() => {
    let pendingAmount = 0, inProgressAmount = 0
    for (const p of payouts) {
      const amount = p.settlement?.gross_amount_cents ?? 0
      if (p.status === "pending") pendingAmount += amount
      if (p.status === "in_progress") inProgressAmount += amount
    }
    return { pending: scheduled.length, pendingAmount, inProgress: inProgress.length, inProgressAmount }
  }, [payouts, scheduled.length, inProgress.length])

  const handleCopy = (text: string) => {
    copy(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  const exportCsv = (onlySelected = false) => {
    const items = onlySelected ? payouts.filter((p) => selected.has(p.id)) : payouts
    const header = ["id", "settlement_id", "status", "created_at"]
    const rows = items.map((p) => [p.id, p.settlement_id, p.status, p.created_at])
    downloadCsv("payouts", header, rows)
  }

  return (
    <AdminShell active="payouts" crumbs={["Admin", "Pagos a vendedores"]}>
      <div className="page-layout">
        <div className="page-header">
        <div>
          <h1 className="page-title">Pagos a vendedores</h1>
          <p className="page-sub">Registro de pagos generados. Finanzas los procesa externamente contra Mercado Pago.</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => payoutsQuery.refetch()} disabled={payoutsQuery.isFetching}>{payoutsQuery.isFetching ? <><Icons.Retry /> Refrescando…</> : <><Icons.Retry /> Refrescar</>}</button>
          <button className="btn btn-secondary" onClick={() => exportCsv()}><Icons.Download /> Exportar</button>
        </div>
      </div>

      <div className="grid-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Pendientes</div><div className="v tnum">{totals.pending}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{ARS(totals.pendingAmount)}</div></div>
        <div className="card kpi"><div className="label">En curso</div><div className="v tnum">{totals.inProgress}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{ARS(totals.inProgressAmount)}</div></div>
        <div className="card kpi"><div className="label">Completados</div><div className="v tnum">{completed.length}</div></div>
        <div className="card kpi"><div className="label">Revisión manual</div><div className="v tnum" style={{ color: "oklch(0.50 0.18 305)" }}>{failed.length}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Requieren acción</div></div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <div role="tab" tabIndex={0} aria-selected={tab === "queue"} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`tab ${tab === "queue" ? "active" : ""}`} onClick={() => setTab("queue")}>Cola actual<span className="ct">{scheduled.length}</span></div>
        <div role="tab" tabIndex={0} aria-selected={tab === "attention"} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`tab ${tab === "attention" ? "active" : ""}`} onClick={() => setTab("attention")}>Atención<span className="ct">{failed.length}</span></div>
        <div role="tab" tabIndex={0} aria-selected={tab === "history"} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Historial<span className="ct">{completed.length}</span></div>
      </div>

      <div className="filterbar">
        <input type="search" className="search-input" placeholder="Buscar…" value={searchQ} onChange={e => { setSearchQ(e.target.value); setPage(1) }} />
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Filtros rápidos:</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "today" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "today" ? "" : "today"); setPage(1) }}>Hoy</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "7d" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "7d" ? "" : "7d"); setPage(1) }}>7 días</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "30d" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "30d" ? "" : "30d"); setPage(1) }}>30 días</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "90d" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "90d" ? "" : "90d"); setPage(1) }}>3 meses</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "1y" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "1y" ? "" : "1y"); setPage(1) }}>1 año</span>
        {(dateRange || searchQ) && (
          <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className="filter-chip" style={{ color: "var(--destructive)", borderColor: "transparent" }} onClick={() => { setDateRange(""); setSearchQ(""); setPage(1) }}>
            Limpiar filtros
          </span>
        )}
      </div>

      <div className="card">
        <div className="card-head" style={{ justifyContent: "space-between" }}>
          <h2 className="sec-title">{tab === "attention" ? "Fallidos" : tab === "history" ? "Completados" : "Cola de pagos"}</h2>
        </div>
        <ScrollArea>
          <table className="t">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <span role="checkbox" aria-checked={selected.size > 0 ? (selected.size === displayedPayouts.length ? true : "mixed") : false} tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`cb ${selected.size > 0 ? (selected.size === displayedPayouts.length ? "checked" : "indeterminate") : ""}`} onClick={selectAll}>
                    {selected.size === displayedPayouts.length ? <Icons.Check /> : selected.size > 0 ? <Icons.Minus /> : null}
                  </span>
                </th>
                <th>ID</th>
                <th>Liquidación</th>
                <th>Estado</th>
                <th className="num"><span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className="sort-h" onClick={() => handleSort("amount")}>Monto {sortIcon("amount")}</span></th>
                <th className="actions-cell"></th>
              </tr>
            </thead>
            <tbody>
                {payoutsQuery.isFetching ? (
                  <tr><td colSpan={6}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
                ) : displayedPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      <div className="icon-wrap"><Icons.Send /></div>
                    <div className="t">No hay pagos</div>
                    <div className="s">Los pagos aparecen cuando las liquidaciones se generan.</div>
                    </td>
                  </tr>
                ) : (
                  sortedPayouts.map((p) => (
                  <tr key={p.id} className={selected.has(p.id) ? "row-selected" : ""} onClick={() => router.push(`/admin/payouts/${p.id}`)} style={{ cursor: "pointer" }}>
                    <td className="checkbox-cell" onClick={e => e.stopPropagation()}>
                      <span role="checkbox" aria-checked={selected.has(p.id)} tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`cb ${selected.has(p.id) ? "checked" : ""}`} onClick={() => toggleSelect(p.id)}>
                        {selected.has(p.id) ? <Icons.Check /> : null}
                      </span>
                    </td>
                    <td className="id"><Link href={`/admin/payouts/${p.id}`} className="row-link" onClick={e => e.stopPropagation()}>{p.id}</Link></td>
                    <td className="id">{p.settlement_id.slice(0, 14)}…</td>
                    <td><span className={`badge ${p.status}`}><span className="dot" />{{ pending: "pendiente", in_progress: "en curso", completed: "completado", failed: "fallido", manual_review: "revisión manual" }[p.status] ?? p.status}</span></td>
                    <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(p.settlement?.gross_amount_cents ?? 0)}</td>
                    <td className="actions-cell" onClick={e => e.stopPropagation()}><span className="icon-btn" onClick={() => handleCopy(p.id)} aria-label="Copiar ID" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} title="Copiar ID"><Icons.Copy /></span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
        <Paginator
          page={page}
          total={pagination.total}
          pageSize={20}
          hasMore={pagination.has_more}
          onPrev={() => setPage((c) => Math.max(1, c - 1))}
          onNext={() => setPage((c) => c + 1)}
        />
      </div>
      {selected.size > 0 && (
        <div className="row gap-3 muted" style={{ marginTop: 14, fontSize: 12.5, flexWrap: "wrap" }}>
          <span>{selected.size} seleccionados</span>
          <span>·</span>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCsv(true)}>Exportar selección</button>
        </div>
      )}
      </div>
    </AdminShell>
  )
}
