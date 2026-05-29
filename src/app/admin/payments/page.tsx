"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { FilterDropdown } from "@/components/admin/filter-dropdown"
import { Paginator } from "@/components/admin/paginator"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePayments } from "@/hooks/use-payments"
import { useToast } from "@/hooks/use-toast"
import type { PaymentFilters } from "@/types/filters"

function copy(text: string) { navigator.clipboard.writeText(text) }

export default function PaymentsPage() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [quickFilter, setQuickFilter] = useState("7d")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const dateFrom = useMemo(() => {
    const now = new Date()
    switch (quickFilter) {
      case "today": return now.toISOString().slice(0, 10)
      case "7d": return new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
      case "30d": return new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
      default: return undefined
    }
  }, [quickFilter])

  const filters = useMemo<PaymentFilters>(
    () => ({ status: statusFilter || undefined, from: dateFrom, page, limit: 20 }),
    [statusFilter, dateFrom, page],
  )

  const paymentsQuery = usePayments(filters)
  const payments = paymentsQuery.data?.data ?? []
  const pagination = paymentsQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }
  const paymentStatusLabels: Record<string, string> = { approved: "aprobado", pending: "pendiente", rejected: "rechazado", cancelled: "cancelado", refunded: "reembolsado" }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === payments.length) setSelected(new Set())
    else setSelected(new Set(payments.map((p) => p.id)))
  }

  const selectedTotal = payments.filter((p) => selected.has(p.id)).reduce((a, b) => a + b.amount_cents, 0)

  const handleCopy = (text: string) => {
    copy(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  const exportCsv = (onlySelected = false) => {
    const items = onlySelected ? payments.filter((p) => selected.has(p.id)) : payments
    const header = ["id", "order_id", "buyer_profile_id", "amount_cents", "status", "created_at"].join(",")
    const rows = items.map((p) =>
      [p.id, p.order_id, p.buyer_profile_id, p.amount_cents, p.status, p.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `payments-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => { setStatusFilter(""); setQuickFilter("7d"); setPage(1) }

  const statusChips = [
    { label: "todos", value: "" },
    { label: "aprobado", value: "approved" },
    { label: "pendiente", value: "pending" },
    { label: "rechazado", value: "rejected" },
    { label: "cancelado", value: "cancelled" },
  ]

  return (
    <AdminShell active="payments" crumbs={["Admin", "Pagos"]}>
      <div className="page-layout">
        <div className="page-header">
        <div>
          <h1 className="page-title">Pagos</h1>
          <p className="page-sub">Todos los cobros iniciados desde Buyer App. El estado real se resuelve vía Mercado Pago.</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => paymentsQuery.refetch()} disabled={paymentsQuery.isFetching}>{paymentsQuery.isFetching ? <><Icons.Retry /> Refrescando…</> : <><Icons.Retry /> Refrescar</>}</button>
          <button className="btn btn-secondary" onClick={() => exportCsv()}><Icons.Download /> Exportar</button>
        </div>
      </div>

      <div className="filterbar">
        <FilterDropdown
          label="Estado"
          icon={<Icons.Filter />}
          value={statusFilter}
          options={statusChips}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
        />
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Rápidos:</span>
        <span className={`filter-chip ${quickFilter === "today" ? "active" : ""}`} onClick={() => setQuickFilter("today")}>Hoy</span>
        <span className={`filter-chip ${quickFilter === "7d" ? "active" : ""}`} onClick={() => setQuickFilter("7d")}>7 días</span>
        <span className={`filter-chip ${quickFilter === "30d" ? "active" : ""}`} onClick={() => setQuickFilter("30d")}>30 días</span>
        <span className="filter-chip" style={{ color: "var(--destructive)", borderColor: "transparent" }} onClick={clearFilters}>
          Limpiar filtros
        </span>
      </div>

      <div className="card">
        <ScrollArea>
          <table className="t">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <span className={`cb ${selected.size > 0 ? (selected.size === payments.length ? "checked" : "indeterminate") : ""}`} onClick={selectAll}>
                    {selected.size === payments.length ? <Icons.Check /> : selected.size > 0 ? <Icons.Minus /> : null}
                  </span>
                </th>
                <th>ID</th>
                <th>Orden</th>
                <th className="num"><span className="sort-h">Monto <Icons.Down /></span></th>
                <th>Estado</th>
                <th>Método</th>
                <th><span className="sort-h">Fecha <Icons.Down /></span></th>
                <th>Ref. MP</th>
                <th className="actions-cell"></th>
              </tr>
            </thead>
            <tbody>
              {paymentsQuery.isFetching ? (
                <tr><td colSpan={9}>{[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    <div className="icon-wrap"><Icons.CreditCard /></div>
                    <div className="t">No hay pagos</div>
                    <div className="s">Ajustá los filtros o importá transacciones desde Mercado Pago.</div>
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className={selected.has(p.id) ? "row-selected" : ""}>
                    <td className="checkbox-cell">
                      <span className={`cb ${selected.has(p.id) ? "checked" : ""}`} onClick={() => toggleSelect(p.id)}>
                        {selected.has(p.id) ? <Icons.Check /> : null}
                      </span>
                    </td>
                    <td className="id">
                      <Link href={`/admin/payments/${p.id}`} className="row-link">{p.id.slice(0, 18)}…</Link>
                    </td>
                    <td className="id">{p.order_id.slice(0, 18)}…</td>
                    <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(p.amount_cents)}</td>
                    <td><span className={`badge ${p.status}`}><span className="dot" />{paymentStatusLabels[p.status] ?? p.status}</span></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{p.method ?? p.buyer_profile_id.slice(0, 10)}…</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(p.created_at)}</td>
                    <td className="id">{p.gateway_reference?.slice(0, 14) ?? <span className="muted">—</span>}…</td>
                    <td className="actions-cell">
                      <span className="icon-btn" onClick={() => handleCopy(p.id)} title="Copiar ID"><Icons.Copy /></span>
                    </td>
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
          <span>Total seleccionado: <span className="tnum" style={{ color: "var(--foreground)", fontWeight: 600 }}>{ARS(selectedTotal)}</span></span>
          <span>·</span>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCsv(true)}>Exportar selección</button>
        </div>
      )}
      </div>
    </AdminShell>
  )
}
