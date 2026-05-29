"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { FilterDropdown } from "@/components/admin/filter-dropdown"
import { Paginator } from "@/components/admin/paginator"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useMarkSettlementsPaid, useSettlements } from "@/hooks/use-settlements"
import { useToast } from "@/hooks/use-toast"
import type { SettlementFilters } from "@/types/filters"

function copy(text: string) { navigator.clipboard.writeText(text) }

export default function SettlementsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [sellerFilter, setSellerFilter] = useState<string>("")
  const [dateRange, setDateRange] = useState<string>("")

  const filters = useMemo<SettlementFilters>(() => ({
    page,
    limit: 20,
    status: statusFilter || undefined,
    ...(sellerFilter ? { sellerId: sellerFilter } : {}),
    ...(dateRange === "month" ? { from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString() } : {}),
  }), [page, statusFilter, sellerFilter, dateRange])

  const q = useSettlements(filters)
  const markPaid = useMarkSettlementsPaid()
  const settlements = q.data?.data ?? []
  const pagination = q.data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }

  const totals = settlements.reduce(
    (a, s) => ({ gross: a.gross + s.gross_amount_cents, fee: a.fee + s.fee_amount_cents, net: a.net + s.net_amount_cents }),
    { gross: 0, fee: 0, net: 0 },
  )

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === settlements.length) setSelected(new Set())
    else setSelected(new Set(settlements.map((s) => s.id)))
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of settlements) counts[s.status] = (counts[s.status] || 0) + 1
    return counts
  }, [settlements])

  const handleMarkPaid = async () => {
    if (selected.size === 0) return
    if (!confirm(`¿Marcar ${selected.size} settlements como pagados?`)) return
    await markPaid.mutateAsync(Array.from(selected))
    setSelected(new Set())
    toast({ description: `${selected.size} settlements marcados como pagados` })
  }

  const handleCopy = (text: string) => {
    copy(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  const exportCsv = (onlySelected = false) => {
    const items = onlySelected ? settlements.filter((s) => selected.has(s.id)) : settlements
    const header = ["id", "payment_id", "seller_profile_id", "gross_amount_cents", "fee_amount_cents", "net_amount_cents", "status", "created_at"].join(",")
    const rows = items.map((s) =>
      [s.id, s.payment_id, s.seller_profile_id, s.gross_amount_cents, s.fee_amount_cents, s.net_amount_cents, s.status, s.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `settlements-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell active="settlements" crumbs={["Admin", "Liquidaciones"]}>
      <div className="page-layout">
        <div className="page-header">
        <div>
          <h1 className="page-title">Liquidaciones</h1>
          <p className="page-sub">Liquidaciones por vendedor. Se generan al confirmar entrega.</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? <><Icons.Retry /> Refrescando…</> : <><Icons.Retry /> Refrescar</>}</button>
          <button className="btn btn-secondary" onClick={() => exportCsv()}><Icons.Download /> Exportar</button>
          <button className="btn btn-primary" onClick={() => router.push("/admin/payouts")}><Icons.Send /> Ir a pagos a vendedores</button>
        </div>
      </div>

      <div className="grid-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Pendientes</div><div className="v tnum">{statusCounts["pending"] || 0}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Requieren pago</div></div>
        <div className="card kpi"><div className="label">Pagados</div><div className="v tnum">{statusCounts["paid"] || 0}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Completados</div></div>
        <div className="card kpi"><div className="label">Fallidas</div><div className="v tnum" style={{ color: "oklch(0.55 0.18 25)" }}>{statusCounts["failed"] || 0}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Requieren reintento</div></div>
        <div className="card kpi"><div className="label">Revisión manual</div><div className="v tnum" style={{ color: "oklch(0.50 0.18 305)" }}>{statusCounts["manual_review"] || 0}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Requiere acción</div></div>
      </div>

      <div className="filterbar">
        <FilterDropdown
          label="Estado"
          icon={<Icons.Filter />}
          value={statusFilter}
          options={[
            { label: "todos", value: "" },
            { label: "pendiente", value: "pending" },
            { label: "pagado", value: "paid" },
            { label: "fallido", value: "failed" },
            { label: "revisión manual", value: "manual_review" },
          ]}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
        />
        <span className="filter-chip"><span>Seller</span><Icons.Down /></span>
        <span style={{ flex: 1 }} />
        <span className={`filter-chip ${dateRange === "month" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "month" ? "" : "month"); setPage(1) }}>Este mes</span>
        {(statusFilter || sellerFilter || dateRange) && (
          <span className="filter-chip" style={{ color: "var(--destructive)", borderColor: "transparent" }} onClick={() => { setStatusFilter(""); setSellerFilter(""); setDateRange(""); setPage(1) }}>
            Limpiar filtros
          </span>
        )}
      </div>

      <div className="card">
        <ScrollArea>
          <table className="t">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <span className={`cb ${selected.size > 0 ? (selected.size === settlements.length ? "checked" : "indeterminate") : ""}`} onClick={selectAll}>
                    {selected.size === settlements.length ? <Icons.Check /> : selected.size > 0 ? <Icons.Minus /> : null}
                  </span>
                </th>
                <th>Liquidación</th>
                <th>Vendedor</th>
                <th>Pago</th>
                <th className="num"><span className="sort-h">Bruto <Icons.Down /></span></th>
                <th className="num">Comisión</th>
                <th className="num"><span className="sort-h">Neto <Icons.Down /></span></th>
                <th>Estado</th>
                <th>Fecha</th>
                <th className="actions-cell"></th>
              </tr>
            </thead>
            <tbody>
              {q.isFetching ? (
                <tr><td colSpan={10}>{[0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={10} className="empty">
                    <div className="icon-wrap"><Icons.Coins /></div>
                    <div className="t">No hay liquidaciones</div>
                    <div className="s">Las liquidaciones aparecen cuando se entregan órdenes.</div>
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className={selected.has(s.id) ? "row-selected" : ""}>
                    <td className="checkbox-cell">
                      <span className={`cb ${selected.has(s.id) ? "checked" : ""}`} onClick={() => toggleSelect(s.id)}>
                        {selected.has(s.id) ? <Icons.Check /> : null}
                      </span>
                    </td>
                    <td className="id"><Link href={`/admin/settlements/${s.id}`} className="row-link">{s.id.slice(0, 18)}…</Link></td>
                    <td>{s.seller_profile_id.slice(0, 10)}…</td>
                    <td className="id">{s.payment_id.slice(0, 14)}…</td>
                    <td className="num tnum">{ARS(s.gross_amount_cents, { bare: true })}</td>
                    <td className="num tnum muted">−{ARS(s.fee_amount_cents, { bare: true })}</td>
                    <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(s.net_amount_cents, { bare: true })}</td>
                    <td><span className={`badge ${s.status}`}><span className="dot" />{{ pending: "pendiente", paid: "pagado", failed: "fallido", manual_review: "revisión manual", cancelled: "cancelado" }[s.status] ?? s.status}</span></td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(s.created_at)}</td>
                    <td className="actions-cell">
                      <span className="icon-btn" onClick={() => handleCopy(s.id)} title="Copiar ID"><Icons.Copy /></span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
        <div className="foot-summary">
          <div className="col"><span className="lbl">Total bruto</span><span className="val tnum">{ARS(totals.gross)}</span></div>
          <div className="col"><span className="lbl">Total comisiones</span><span className="val tnum">{ARS(totals.fee)}</span></div>
          <div className="col"><span className="lbl">Total neto</span><span className="val tnum">{ARS(totals.net)}</span></div>
          <div style={{ flex: 1 }} />
          <div className="row gap-2" style={{ alignSelf: "center" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCsv(true)} disabled={selected.size === 0}>
              Exportar selección ({selected.size})
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleMarkPaid} disabled={selected.size === 0 || markPaid.isPending}>
              Marcar como pagado ({selected.size})
            </button>
          </div>
        </div>
      </div>
      </div>
    </AdminShell>
  )
}
