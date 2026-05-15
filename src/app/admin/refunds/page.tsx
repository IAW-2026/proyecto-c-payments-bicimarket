"use client"

import { useMemo, useState } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { useCreateRefund, useRefunds } from "@/hooks/use-refunds"
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
  const [page, setPage] = useState(1)
  const [showDialog, setShowDialog] = useState(false)
  const [createPaymentId, setCreatePaymentId] = useState("")
  const [createAmount, setCreateAmount] = useState("")
  const [createReason, setCreateReason] = useState<RefundReason>("manual")

  const filters = useMemo<RefundFilters>(() => ({ page, limit: 20 }), [page])

  const refundsQuery = useRefunds(filters)
  const createRefund = useCreateRefund()
  const refunds = (refundsQuery.data?.data ?? []) as Refund[]
  const pagination = refundsQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }

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
  }

  const exportCsv = () => {
    const header = ["id", "payment_id", "amount_cents", "reason", "status", "created_at"].join(",")
    const rows = refunds.map((r) =>
      [r.id, r.payment_id, r.amount_cents, r.reason, r.status, r.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `refunds-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position: "relative" }}>
      <AdminShell active="refunds" crumbs={["Admin", "Refunds"]}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <h1 className="page-title">Refunds</h1>
            <p className="page-sub">Reembolsos totales o parciales contra Mercado Pago.</p>
          </div>
          <div className="row gap-2">
            <button className="btn btn-secondary" onClick={exportCsv}><Icons.Download /> Exportar</button>
            <button className="btn btn-primary" onClick={() => setShowDialog(true)}><Icons.Plus /> Crear refund</button>
          </div>
        </div>

        <div className="filterbar">
          <span className="filter-chip has-value"><Icons.Filter />Estado: <span className="v">todos</span><Icons.Down /></span>
          <span className="filter-chip"><span>Motivo</span><Icons.Down /></span>
          <span className="filter-chip"><Icons.Calendar /><span>Fecha</span><Icons.Down /></span>
          <span className="filter-chip"><span>Payment ID</span><Icons.Down /></span>
          <span style={{ flex: 1 }} />
          <span className="filter-chip active">Últimos 30 días</span>
        </div>

        <div className="card">
          <table className="t">
            <thead>
              <tr>
                <th className="checkbox-cell"><span className="cb" /></th>
                <th>Refund ID</th>
                <th>Payment</th>
                <th className="num">Monto</th>
                <th>Tipo</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th>Creado</th>
                <th className="actions-cell"></th>
              </tr>
            </thead>
            <tbody>
              {refundsQuery.isLoading ? (
                <tr><td colSpan={9}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
              ) : refunds.length === 0 ? (
                <tr>
                  <td colSpan={9} className="empty">
                    <div className="icon-wrap"><Icons.Undo /></div>
                    <div className="t">No hay refunds</div>
                    <div className="s">Creá uno nuevo desde un pago aprobado.</div>
                    <div className="a">
                      <button className="btn btn-primary" onClick={() => setShowDialog(true)}><Icons.Plus /> Crear refund</button>
                    </div>
                  </td>
                </tr>
              ) : (
                refunds.map((r) => {
                  const payment = (r as Refund & { payment?: { order_id?: string } }).payment
                  return (
                    <tr key={r.id}>
                      <td className="checkbox-cell"><span className="cb" /></td>
                      <td className="id"><span className="row-link">{r.id}</span></td>
                      <td className="id">{r.payment_id.slice(0, 14)}…</td>
                      <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(r.amount_cents)}</td>
                      <td><span className="tag" style={{ textTransform: "capitalize" }}>{r.amount_cents >= 100000 ? "full" : "partial"}</span></td>
                      <td><span className="badge badge-soft-primary">{reasonLabels[r.reason]}</span></td>
                      <td><span className={`badge ${r.status}`}><span className="dot" />{r.status}</span></td>
                      <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(r.created_at)}</td>
                      <td className="actions-cell"><span className="icon-btn" onClick={() => copy(r.id)} title="Copiar ID"><Icons.Copy /></span></td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          <div className="paginator">
            <div className="row gap-3">
              <span>Mostrando <span className="tnum">1–{refunds.length}</span> de <span className="tnum">{pagination.total}</span></span>
            </div>
            <div className="page-arrows">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((c) => Math.max(1, c - 1))}>
                <Icons.Chevron style={{ transform: "rotate(180deg)" }} /> Anterior
              </button>
              <button className="btn btn-secondary btn-sm" disabled={!pagination.has_more} onClick={() => setPage((c) => c + 1)}>
                Siguiente <Icons.Chevron />
              </button>
            </div>
          </div>
        </div>
      </AdminShell>

      {showDialog && (
        <div className="dialog-backdrop" style={{ position: "fixed", zIndex: 1000 }}>
          <div className="dialog lg">
            <div className="dialog-head">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="dialog-title">Crear refund</div>
                  <div className="dialog-sub">El refund se procesa contra Mercado Pago.</div>
                </div>
                <span className="icon-btn" onClick={() => setShowDialog(false)}><Icons.X /></span>
              </div>
            </div>
            <div className="dialog-body">
              <div className="field">
                <span className="l">Payment ID <span className="required">*</span></span>
                <input
                  type="text"
                  value={createPaymentId}
                  onChange={(e) => setCreatePaymentId(e.target.value)}
                  placeholder="pay_..."
                  className="input"
                  style={{ width: "100%", fontFamily: "var(--font-geist-mono)", fontSize: 13 }}
                />
              </div>
              <div className="field">
                <span className="l">Monto <span className="required">*</span></span>
                <input
                  type="number"
                  value={createAmount}
                  onChange={(e) => setCreateAmount(e.target.value)}
                  placeholder="Monto en centavos"
                  className="input"
                  style={{ width: "100%" }}
                />
              </div>
              <div className="field">
                <span className="l">Motivo <span className="required">*</span></span>
                <select
                  value={createReason}
                  onChange={(e) => setCreateReason(e.target.value as RefundReason)}
                  className="input"
                  style={{ width: "100%" }}
                >
                  <option value="seller_rejected">Seller rejected</option>
                  <option value="buyer_cancelled">Buyer cancelled</option>
                  <option value="not_delivered">Not delivered</option>
                  <option value="manual">Manual (admin)</option>
                </select>
              </div>
              <div className="alert warn">
                <Icons.AlertTri className="ic" />
                <div className="col">
                  <span className="a-title">Esta acción es irreversible</span>
                  <span className="a-body">Al confirmar, Mercado Pago iniciará el refund. Los settlements asociados pasarán a cancelled automáticamente.</span>
                </div>
              </div>
            </div>
            <div className="dialog-foot">
              <button className="btn btn-ghost" onClick={() => setShowDialog(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={createRefund.isPending}>
                <Icons.Undo /> Confirmar refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
