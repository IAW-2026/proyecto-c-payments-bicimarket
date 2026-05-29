"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { FilterDropdown } from "@/components/admin/filter-dropdown"
import { Paginator } from "@/components/admin/paginator"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCreateRefund, useRefunds } from "@/hooks/use-refunds"
import { useToast } from "@/hooks/use-toast"
import type { RefundFilters } from "@/hooks/use-refunds"
import type { Refund, RefundReason } from "@/types/payments"

const reasonLabels: Record<RefundReason, string> = {
  seller_rejected: "Seller rechazó",
  buyer_cancelled: "Comprador canceló",
  not_delivered: "No entregado",
  manual: "Manual (admin)",
}

function copy(text: string) { navigator.clipboard.writeText(text) }

export default function RefundsPage() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showDialog, setShowDialog] = useState(false)
  const [createPaymentId, setCreatePaymentId] = useState("")
  const [createAmount, setCreateAmount] = useState("")
  const [createReason, setCreateReason] = useState<RefundReason>("manual")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [reasonFilter, setReasonFilter] = useState<string>("")
  const [dateRange, setDateRange] = useState<string>("")

  const filters = useMemo<RefundFilters>(() => ({
    page,
    limit: 20,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(reasonFilter ? { reason: reasonFilter } : {}),
    ...(dateRange === "30d" ? { from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) } : {}),
  }), [page, statusFilter, reasonFilter, dateRange])

  const refundsQuery = useRefunds(filters)
  const createRefund = useCreateRefund()
  const refunds = (refundsQuery.data?.data ?? []) as Refund[]
  const pagination = refundsQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === refunds.length) setSelected(new Set())
    else setSelected(new Set(refunds.map((r) => r.id)))
  }

  const handleCreate = async () => {
    if (!createPaymentId || !createAmount) return
    await createRefund.mutateAsync({
      payment_id: createPaymentId,
      amount_cents: Number(createAmount),
      reason: createReason,
    })
    setCreatePaymentId("")
    setCreateAmount("")
    setShowDialog(false)
    toast({ description: "Refund creado exitosamente" })
  }

  const handleCopy = (text: string) => {
    copy(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  const exportCsv = (onlySelected = false) => {
    const items = onlySelected ? refunds.filter((r) => selected.has(r.id)) : refunds
    const header = ["id", "payment_id", "amount_cents", "reason", "status", "created_at"].join(",")
    const rows = items.map((r) =>
      [r.id, r.payment_id, r.amount_cents, r.reason, r.status, r.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `refunds-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <AdminShell active="refunds" crumbs={["Admin", "Reembolsos"]}>
        <div className="page-layout">
          <div className="page-header">
          <div>
            <h1 className="page-title">Reembolsos</h1>
            <p className="page-sub">Reembolsos totales o parciales contra Mercado Pago.</p>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={() => refundsQuery.refetch()} disabled={refundsQuery.isFetching}>{refundsQuery.isFetching ? <><Icons.Retry /> Refrescando…</> : <><Icons.Retry /> Refrescar</>}</button>
            <button className="btn btn-secondary" onClick={() => exportCsv()}><Icons.Download /> Exportar</button>
            <button className="btn btn-primary" onClick={() => setShowDialog(true)}><Icons.Plus /> Crear refund</button>
          </div>
        </div>

        <div className="filterbar">
          <FilterDropdown
            label="Estado"
            value={statusFilter}
            options={[
              { label: "todos", value: "" },
              { label: "pendiente", value: "pending" },
              { label: "aprobado", value: "approved" },
              { label: "fallido", value: "failed" },
            ]}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
          />
          <FilterDropdown
            label="Motivo"
            value={reasonFilter}
            options={[
              { label: "todos", value: "" },
              { label: "Manual (admin)", value: "manual" },
              { label: "Seller rechazó", value: "seller_rejected" },
              { label: "Comprador canceló", value: "buyer_cancelled" },
              { label: "No entregado", value: "not_delivered" },
            ]}
            onChange={(v) => { setReasonFilter(v); setPage(1) }}
          />
          <span className={`filter-chip ${dateRange === "30d" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "30d" ? "" : "30d"); setPage(1) }}>Últimos 30 días</span>
          {(statusFilter || reasonFilter || dateRange) && (
            <span className="filter-chip" style={{ color: "var(--destructive)", borderColor: "transparent" }} onClick={() => { setStatusFilter(""); setReasonFilter(""); setDateRange(""); setPage(1) }}>
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
                    <span className={`cb ${selected.size > 0 ? (selected.size === refunds.length ? "checked" : "indeterminate") : ""}`} onClick={selectAll}>
                      {selected.size === refunds.length ? <Icons.Check /> : selected.size > 0 ? <Icons.Minus /> : null}
                    </span>
                  </th>
                  <th>ID</th>
                  <th>Pago</th>
                  <th className="num">Monto</th>
                  <th>Tipo</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th className="actions-cell"></th>
                </tr>
              </thead>
              <tbody>
                {refundsQuery.isFetching ? (
                  <tr><td colSpan={9}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
                ) : refunds.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty">
                      <div className="icon-wrap"><Icons.Undo /></div>
                      <div className="t">No hay reembolsos</div>
                      <div className="s">Creá uno nuevo desde un pago aprobado.</div>
                      <div className="a">
            <button className="btn btn-primary" onClick={() => setShowDialog(true)}><Icons.Plus /> Crear reembolso</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  refunds.map((r) => {
                    const payment = (r as Refund & { payment?: { order_id?: string } }).payment
                    return (
                      <tr key={r.id} className={selected.has(r.id) ? "row-selected" : ""}>
                        <td className="checkbox-cell">
                          <span className={`cb ${selected.has(r.id) ? "checked" : ""}`} onClick={() => toggleSelect(r.id)}>
                            {selected.has(r.id) ? <Icons.Check /> : null}
                          </span>
                        </td>
                        <td className="id"><Link href={`/admin/refunds/${r.id}`} className="row-link">{r.id}</Link></td>
                        <td className="id">{r.payment_id.slice(0, 14)}…</td>
                        <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(r.amount_cents)}</td>
                        <td><span className="tag" style={{ textTransform: "capitalize" }}>{r.amount_cents >= 100000 ? "total" : "parcial"}</span></td>
                        <td><span className="badge badge-soft-primary">{reasonLabels[r.reason]}</span></td>
                        <td><span className={`badge ${r.status}`}><span className="dot" />{{ pending: "pendiente", approved: "aprobado", failed: "fallido" }[r.status] ?? r.status}</span></td>
                        <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(r.created_at)}</td>
                        <td className="actions-cell"><span className="icon-btn" onClick={() => handleCopy(r.id)} title="Copiar ID"><Icons.Copy /></span></td>
                      </tr>
                    )
                  })
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
          <span>Total seleccionado: <span className="tnum" style={{ color: "var(--foreground)", fontWeight: 600 }}>{ARS(refunds.filter((r) => selected.has(r.id)).reduce((a, b) => a + b.amount_cents, 0))}</span></span>
          <span>·</span>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCsv(true)}>Exportar selección</button>
        </div>
      )}
        </div>
      </AdminShell>

      {showDialog && (
        <div className="dialog-backdrop">
          <div className="dialog lg">
            <div className="dialog-head">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="dialog-title">Crear reembolso</div>
                  <div className="dialog-sub">El reembolso se procesa contra Mercado Pago.</div>
                </div>
                <span className="icon-btn" onClick={() => setShowDialog(false)} aria-label="Cerrar"><Icons.X /></span>
              </div>
            </div>
            <div className="dialog-body">
              <div className="field">
                <span className="l" id="refund-payment-label">ID de Pago <span className="required">*</span></span>
                <input
                  type="text"
                  value={createPaymentId}
                  onChange={(e) => setCreatePaymentId(e.target.value)}
                  placeholder="pay_..."
                  className="input"
                  aria-labelledby="refund-payment-label"
                  style={{ width: "100%", fontFamily: "var(--font-geist-mono)", fontSize: 13 }}
                />
              </div>
              <div className="field">
                <span className="l" id="refund-amount-label">Monto <span className="required">*</span></span>
                <input
                  type="number"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  placeholder="Monto en centavos"
                  className="input"
                  aria-labelledby="refund-amount-label"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="field">
                <span className="l" id="refund-reason-label">Motivo <span className="required">*</span></span>
                <select
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value as RefundReason)}
                  className="input"
                  aria-labelledby="refund-reason-label"
                  style={{ width: "100%" }}
                >
                  <option value="seller_rejected">Vendedor rechazó</option>
                  <option value="buyer_cancelled">Comprador canceló</option>
                  <option value="not_delivered">No entregado</option>
                  <option value="manual">Manual (admin)</option>
                </select>
              </div>
              <div className="alert warn" role="alert">
                <Icons.AlertTri className="ic" />
                <div className="col">
                  <span className="a-title">Esta acción es irreversible</span>
                  <span className="a-body">Al confirmar, Mercado Pago iniciará el reembolso. Las liquidaciones asociadas pasarán a canceled automáticamente.</span>
                </div>
              </div>
            </div>
            <div className="dialog-foot">
              <button className="btn btn-ghost" onClick={() => setShowDialog(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={createRefund.isPending}>
                <Icons.Undo /> Confirmar reembolso
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
