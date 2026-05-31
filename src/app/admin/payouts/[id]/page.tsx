"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { usePayout, useMarkPayoutPaid } from "@/hooks/use-settlements"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"

const payoutStatusLabels: Record<string, string> = {
  pending: "pendiente",
  in_progress: "en curso",
  completed: "completado",
  failed: "fallido",
  manual_review: "revisión manual",
}
const settlementStatusLabels: Record<string, string> = { pending: "pendiente", paid: "pagado", failed: "fallido", manual_review: "revisión manual", cancelled: "cancelado" }

export default function PayoutDetailPage() {
  const { toast } = useToast()
  const params = useParams<{ id: string }>()
  const payoutId = Array.isArray(params.id) ? params.id[0] : params.id

  const payout = usePayout(payoutId)
  const markPaid = useMarkPayoutPaid()

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  const [alertOpen, setAlertOpen] = useState(false)

  const handleMarkPaid = async () => {
    setAlertOpen(false)
    await markPaid.mutateAsync(payoutId)
    toast({ description: "Pago a vendedor marcado como pagado" })
  }

  if (payout.isLoading || !payout.data) {
    return (
      <AdminShell active="payouts" crumbs={["Admin", "Pagos a vendedores", "detalle"]}>
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

  const d: any = payout.data
  const settlement: any = d.settlement
  const payment: any = settlement?.payment

  return (
    <AdminShell active="payouts" crumbs={["Admin", "Pagos a vendedores", `${d.id.slice(0, 14)}…`]}>
      <div className="page-layout">
        <div className="detail-header">
          <div className="col gap-3">
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{d.id}</span>
              <span className="icon-btn" onClick={() => handleCopy(d.id)} aria-label="Copiar ID" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} title="Copiar ID"><Icons.Copy /></span>
              <span className={`badge ${d.status} badge-lg`}><span className="dot" />{payoutStatusLabels[d.status] ?? d.status}</span>
            </div>
            <div className="row gap-3" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
              {settlement && <h1 className="page-title" style={{ fontSize: 30, margin: 0 }}>{ARS(settlement.net_amount_cents)}</h1>}
              {!settlement && <h1 className="page-title" style={{ fontSize: 30, margin: 0 }}>—</h1>}
              <span className="muted" style={{ fontSize: 14 }}>Neto transferido al vendedor</span>
            </div>
            <div className="row gap-4 muted" style={{ fontSize: 13, flexWrap: "wrap" }}>
              {settlement && (
                <>
                  <span>Liquidación <Link href={`/admin/settlements/${settlement.id}`} className="mono" style={{ color: "var(--primary)", fontWeight: 500 }}>{settlement.id.slice(0, 18)}… →</Link></span>
                  <span>·</span>
                </>
              )}
              {payment && (
                <>
                  <span>Pago <Link href={`/admin/payments/${payment.id}`} className="mono" style={{ color: "var(--primary)", fontWeight: 500 }}>{payment.id.slice(0, 18)}… →</Link></span>
                  <span>·</span>
                </>
              )}
              <span>Creado {formatDate(d.created_at)}</span>
            </div>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={() => handleCopy(d.id)}><Icons.Copy /> Copiar ID</button>
            {d.status !== "completed" && (
              <button className="btn btn-primary" onClick={() => setAlertOpen(true)} disabled={markPaid.isPending}>
                {markPaid.isPending ? <><Icons.Retry /> Marcando…</> : <><Icons.Check /> Marcar como pagado</>}
              </button>
            )}
          </div>
        </div>

        <div className="page-body-scroll" style={{ paddingTop: 16 }}>
          <div className="detail-grid">
            <div className="col gap-4">
              <div className="card">
                <div className="card-head"><h2 className="sec-title">Estado del pago</h2></div>
                <div className="card-body col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">ID de Pago a Seller</span>
                    <span className="mono" style={{ fontSize: 12 }}>{d.id}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Estado</span>
                    <span className={`badge ${d.status}`}><span className="dot" />{payoutStatusLabels[d.status] ?? d.status}</span>
                  </div>
                  {d.transfer_id && (
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Transfer ID</span>
                      <span className="mono" style={{ fontSize: 12 }}>{d.transfer_id}</span>
                    </div>
                  )}
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Intentos</span>
                    <span>{d.attempts}</span>
                  </div>
                  {d.last_error && (
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Último error</span>
                      <span className="muted" style={{ fontSize: 12, maxWidth: "60%", textAlign: "right" }}>{d.last_error}</span>
                    </div>
                  )}
                  {d.started_at && (
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Iniciado</span>
                      <span>{formatDate(d.started_at)}</span>
                    </div>
                  )}
                  {d.completed_at && (
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Completado</span>
                      <span>{formatDate(d.completed_at)}</span>
                    </div>
                  )}
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Creado</span>
                    <span>{formatDate(d.created_at)}</span>
                  </div>
                </div>
              </div>

              {payment && (
                <div className="card">
                  <div className="card-head"><h2 className="sec-title">Pago original</h2></div>
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
                      <span className="muted">Estado</span>
                      <span className={`badge ${payment.status}`}><span className="dot" />{payment.status}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="col gap-4">
              {settlement && (
                <div className="card">
                  <div className="card-head"><h2 className="sec-title">Liquidación asociada</h2></div>
                  <div className="card-body col gap-3">
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">ID de Liquidación</span>
                      <Link href={`/admin/settlements/${settlement.id}`} className="mono" style={{ fontSize: 12, color: "var(--primary)", fontWeight: 500 }}>{settlement.id.slice(0, 18)}…</Link>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Vendedor</span>
                      <span className="mono" style={{ fontSize: 12 }}>{settlement.seller_profile_id}</span>
                    </div>
                    <div className="divider" style={{ margin: "4px 0" }} />
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Bruto</span>
                      <span className="tnum">{ARS(settlement.gross_amount_cents)}</span>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="muted">Comisión</span>
                      <span className="tnum" style={{ color: "oklch(0.55 0.18 25)" }}>−{ARS(settlement.fee_amount_cents)}</span>
                    </div>
                    <div className="divider" style={{ margin: "4px 0" }} />
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600 }}>Neto transferido</span>
                      <span className="tnum" style={{ fontWeight: 600, fontSize: 16, color: "var(--primary)" }}>{ARS(settlement.net_amount_cents)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="card">
                <div className="card-head"><h2 className="sec-title">Detalles</h2></div>
                <div className="card-body col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Estado liquidación</span>
                    {settlement ? (
                      <span className={`badge ${settlement.status}`}><span className="dot" />{settlementStatusLabels[settlement.status] ?? settlement.status}</span>
                    ) : <span className="muted">—</span>}
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Intentos de pago</span>
                    <span>{d.attempts}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Actualizado</span>
                    <span>{formatDate(d.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como pagado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Confirmás que querés marcar este pago a vendedor como pagado?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid} disabled={markPaid.isPending}>
              {markPaid.isPending ? "Marcando…" : "Sí, marcar como pagado"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  )
}
