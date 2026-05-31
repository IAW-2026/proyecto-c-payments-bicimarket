"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRefund } from "@/hooks/use-refunds"
import { useToast } from "@/hooks/use-toast"

const refundStatusLabels: Record<string, string> = { pending: "pendiente", approved: "aprobado", failed: "fallido" }
const refundReasonLabels: Record<string, string> = {
  seller_rejected: "Vendedor rechazó",
  buyer_cancelled: "Comprador canceló",
  not_delivered: "No entregado",
  manual: "Manual (admin)",
}
const paymentStatusLabels: Record<string, string> = { approved: "aprobado", pending: "pendiente", rejected: "rechazado", cancelled: "cancelado", refunded: "reembolsado" }

export default function RefundDetailPage() {
  const { toast } = useToast()
  const params = useParams<{ id: string }>()
  const refundId = Array.isArray(params.id) ? params.id[0] : params.id

  const refund = useRefund(refundId)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  if (refund.isLoading || !refund.data) {
    return (
      <AdminShell active="refunds" crumbs={["Admin", "Reembolsos", "detalle"]}>
        <div className="page-layout">
          <div className="page-body-scroll">
            <div className="grid-4" style={{ marginBottom: 20 }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="card kpi">
                  <div className="sk" style={{ width: 120, height: 12 }} />
                  <div className="sk" style={{ marginTop: 14, width: 140, height: 28 }} />
                </div>
              ))}
            </div>
            <div className="card"><div className="sk" style={{ width: "100%", height: 400 }} /></div>
          </div>
        </div>
      </AdminShell>
    )
  }

  const d: any = refund.data
  const payment: any = d.payment
  const statusHistory: any[] = d.status_history ?? []

  return (
    <AdminShell active="refunds" crumbs={["Admin", "Reembolsos", `${d.id.slice(0, 14)}…`]}>
      <div className="page-layout">
        <div className="detail-header">
          <div className="col gap-3">
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{d.id}</span>
              <span className="icon-btn" onClick={() => handleCopy(d.id)} aria-label="Copiar ID" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} title="Copiar ID"><Icons.Copy /></span>
              <span className={`badge ${d.status} badge-lg`}><span className="dot" />{refundStatusLabels[d.status] ?? d.status}</span>
            </div>
            <div className="row gap-3" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
              <h1 className="page-title" style={{ fontSize: 30, margin: 0 }}>{ARS(d.amount_cents)}</h1>
              <span className="muted" style={{ fontSize: 14 }}>{d.amount_cents >= 100000 ? "Reembolso total" : "Reembolso parcial"}</span>
            </div>
            <div className="row gap-4 muted" style={{ fontSize: 13, flexWrap: "wrap" }}>
              <span>Motivo <span className="tag">{refundReasonLabels[d.reason] ?? d.reason}</span></span>
              {payment && (
                <>
                  <span>·</span>
                  <span>Pago <Link href={`/admin/payments/${payment.id}`} className="mono" style={{ color: "var(--primary)", fontWeight: 500 }}>{payment.id.slice(0, 18)}… →</Link></span>
                </>
              )}
              <span>·</span>
              <span>Creado {formatDate(d.created_at)}</span>
            </div>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={() => handleCopy(d.id)}><Icons.Copy /> Copiar ID</button>
          </div>
        </div>

        <div className="page-body-scroll" style={{ paddingTop: 16 }}>
          <div className="detail-grid">
            <div className="col gap-4">
              <div className="card">
                <div className="card-head"><h2 className="sec-title">Detalle del reembolso</h2></div>
                <div className="card-body col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">ID de Reembolso</span>
                    <span className="mono" style={{ fontSize: 12 }}>{d.id}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Monto</span>
                    <span className="tnum" style={{ fontWeight: 500 }}>{ARS(d.amount_cents)}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Tipo</span>
                    <span className="tag">{d.amount_cents >= 100000 ? "total" : "parcial"}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Motivo</span>
                    <span className="badge badge-soft-primary">{refundReasonLabels[d.reason] ?? d.reason}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Estado</span>
                    <span className={`badge ${d.status}`}><span className="dot" />{refundStatusLabels[d.status] ?? d.status}</span>
                  </div>
                  {d.gateway_reference && (
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Ref. gateway</span>
                      <span className="mono" style={{ fontSize: 12 }}>{d.gateway_reference}</span>
                    </div>
                  )}
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Creado</span>
                    <span>{formatDate(d.created_at)}</span>
                  </div>
                  {d.updated_at && (
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Actualizado</span>
                      <span>{formatDate(d.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {payment && (
                <div className="card">
                  <div className="card-head"><h2 className="sec-title">Pago asociado</h2></div>
                  <div className="card-body col gap-3">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">ID de Pago</span>
                      <Link href={`/admin/payments/${payment.id}`} className="mono" style={{ fontSize: 12, color: "var(--primary)", fontWeight: 500 }}>{payment.id.slice(0, 18)}…</Link>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Orden</span>
                      <span className="mono" style={{ fontSize: 12 }}>{payment.order_id.slice(0, 18)}…</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Monto del pago</span>
                      <span className="tnum">{ARS(payment.amount_cents)}</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Estado del pago</span>
                      <span className={`badge ${payment.status}`}><span className="dot" />{paymentStatusLabels[payment.status] ?? payment.status}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="col gap-4">
              <div className="card">
                <div className="card-head"><h2 className="sec-title">Historial de estados</h2></div>
                {statusHistory.length === 0 ? (
                  <div className="card-body muted" style={{ fontSize: 13 }}>Sin cambios de estado registrados.</div>
                ) : (
                  <ScrollArea>
                    <table className="t">
                      <thead>
                        <tr>
                          <th>De</th>
                          <th>A</th>
                          <th>Autor</th>
                          <th>Motivo</th>
                          <th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statusHistory.map((h: any) => (
                          <tr key={h.id}>
                            <td>{h.from_status ? <span className="badge"><span className="dot" />{refundStatusLabels[h.from_status] ?? h.from_status}</span> : <span className="muted">—</span>}</td>
                            <td><span className={`badge ${h.to_status}`}><span className="dot" />{refundStatusLabels[h.to_status] ?? h.to_status}</span></td>
                            <td className="muted" style={{ fontSize: 12 }}>{h.changed_by ?? "—"}</td>
                            <td className="muted" style={{ fontSize: 12 }}>{h.reason ?? "—"}</td>
                            <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(h.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </ScrollArea>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
