"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { usePayment, useRefundPayment } from "@/hooks/use-payments"
import { useRefunds } from "@/hooks/use-refunds"
import { useSettlements } from "@/hooks/use-settlements"
import { useToast } from "@/hooks/use-toast"
import type { Refund } from "@/types/payments"

export default function PaymentDetailPage() {
  const { toast } = useToast()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const paymentId = Array.isArray(params.id) ? params.id[0] : params.id

  const [activeTab, setActiveTab] = useState("overview")
  const payment = usePayment(paymentId)
  const settlements = useSettlements({ paymentId, page: 1, limit: 20 })
  const refunds = useRefunds({ paymentId, page: 1, limit: 20 })
  const refundPayment = useRefundPayment()

  const stats = useMemo(() => {
    const settlementList = settlements.data?.data ?? []
    const refundList = (refunds.data?.data ?? []) as Refund[]
    return {
      settlements: settlementList.length,
      refunds: refundList.length,
      gross: settlementList.reduce((t, s) => t + s.gross_amount_cents, 0),
      net: settlementList.reduce((t, s) => t + s.net_amount_cents, 0),
    }
  }, [refunds.data?.data, settlements.data?.data])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  if (payment.isLoading || !payment.data) {
    return (
      <AdminShell active="payments" crumbs={["Admin", "Payments", "detail"]}>
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card kpi">
              <div className="sk" style={{ width: 120, height: 12 }} />
              <div className="sk" style={{ marginTop: 14, width: 140, height: 28 }} />
            </div>
          ))}
        </div>
        <div className="card"><div className="sk" style={{ width: "100%", height: 400 }} /></div>
      </AdminShell>
    )
  }

  const d = payment.data
  const settlementList = settlements.data?.data ?? []
  const refundList = (refunds.data?.data ?? []) as Refund[]

  const handleRefund = async () => {
    if (!confirm(`¿Reembolsar ${ARS(d.amount_cents)} del pago ${d.id}?`)) return
    await refundPayment.mutateAsync({ paymentId: d.id, amount_cents: d.amount_cents, reason: "manual" })
    router.refresh()
    toast({ description: "Reembolso iniciado exitosamente" })
  }

  const downloadReceipt = () => {
    const header = ["field", "value"].join(",")
    const rows = [
      ["id", d.id],
      ["order_id", d.order_id],
      ["buyer_profile_id", d.buyer_profile_id],
      ["amount_cents", String(d.amount_cents)],
      ["currency", d.currency],
      ["status", d.status],
      ["created_at", d.created_at],
    ].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `payment-${d.id.slice(0, 14)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell active="payments" crumbs={["Admin", "Payments", `${d.id.slice(0, 14)}…`]}>
      <div className="detail-header">
        <div className="col gap-3">
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{d.id}</span>
            <span className="icon-btn" onClick={() => handleCopy(d.id)} title="Copiar ID"><Icons.Copy /></span>
            <span className={`badge ${d.status} badge-lg`}><span className="dot" />{d.status}</span>
          </div>
          <h1 className="page-title" style={{ fontSize: 30, margin: 0 }}>{ARS(d.amount_cents)}</h1>
          <div className="row gap-4 muted" style={{ fontSize: 13, flexWrap: "wrap" }}>
            <span>Order <span className="mono" style={{ color: "var(--primary)", fontWeight: 500 }}>{d.order_id.slice(0, 18)}…</span></span>
            <span>·</span>
            <span>Iniciado {formatDate(d.created_at)}</span>
            {d.approved_at && <><span>·</span><span>Aprobado {formatDate(d.approved_at)}</span></>}
          </div>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={downloadReceipt}><Icons.Download /> Comprobante</button>
          <button className="btn btn-primary" onClick={handleRefund} disabled={refundPayment.isPending}>
            <Icons.Undo /> Reembolsar
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <div className={`tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>Overview</div>
        <div className={`tab ${activeTab === "settlements" ? "active" : ""}`} onClick={() => setActiveTab("settlements")}>Settlements<span className="ct">{stats.settlements}</span></div>
        <div className={`tab ${activeTab === "refunds" ? "active" : ""}`} onClick={() => setActiveTab("refunds")}>Refunds<span className="ct">{stats.refunds}</span></div>
      </div>
      {activeTab !== "overview" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: "24px" }}>
            {activeTab === "settlements" ? (
              settlementList.length === 0 ? (
                <div className="muted" style={{ fontSize: 13 }}>Sin settlements asociados.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="t">
                    <thead>
                      <tr>
                        <th>Settlement</th>
                        <th>Seller</th>
                        <th className="num">Gross</th>
                        <th className="num">Fee</th>
                        <th className="num">Net</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementList.map((s) => (
                        <tr key={s.id}>
                          <td className="id"><Link href={`/admin/settlements/${s.id}`} className="row-link">{s.id.slice(0, 14)}…</Link></td>
                          <td>{s.seller_profile_id.slice(0, 10)}…</td>
                          <td className="num tnum">{ARS(s.gross_amount_cents, { bare: true })}</td>
                          <td className="num tnum muted">−{ARS(s.fee_amount_cents, { bare: true })}</td>
                          <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(s.net_amount_cents, { bare: true })}</td>
                          <td><span className={`badge ${s.status}`}><span className="dot" />{s.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : refundList.length === 0 ? (
              <div className="muted" style={{ fontSize: 13 }}>Sin refunds asociados.</div>
            ) : (
              <div className="table-wrapper">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Refund</th>
                      <th className="num">Monto</th>
                      <th>Motivo</th>
                      <th>Estado</th>
                      <th>Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {refundList.map((r) => (
                      <tr key={r.id}>
                        <td className="id"><span className="mono" style={{ fontSize: 12 }}>{r.id}</span></td>
                        <td className="num tnum">{ARS(r.amount_cents)}</td>
                        <td><span className="tag">{r.reason}</span></td>
                        <td><span className={`badge ${r.status}`}><span className="dot" />{r.status}</span></td>
                        <td className="muted" style={{ fontSize: 12 }}>{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "overview" && (
        <div className="detail-grid">
          <div className="col gap-4">
            <div className="card">
              <div className="card-head"><h2 className="sec-title">Desglose del cobro</h2></div>
              <div className="card-body col gap-3">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Total cobrado</span>
                  <span className="tnum" style={{ fontSize: 18, fontWeight: 600 }}>{ARS(d.amount_cents)}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head" style={{ justifyContent: "space-between" }}>
                <h2 className="sec-title">Settlements derivadas</h2>
                <span className="muted" style={{ fontSize: 12 }}>{settlementList.length} registros</span>
              </div>
              {settlementList.length === 0 ? (
                <div className="card-body muted" style={{ fontSize: 13 }}>Sin settlements asociados.</div>
              ) : (
                <div className="table-wrapper">
                  <table className="t">
                    <thead>
                      <tr>
                        <th>Settlement</th>
                        <th>Seller</th>
                        <th className="num">Gross</th>
                        <th className="num">Fee</th>
                        <th className="num">Net</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlementList.map((s) => (
                        <tr key={s.id}>
                          <td className="id"><Link href={`/admin/settlements/${s.id}`} className="row-link">{s.id.slice(0, 14)}…</Link></td>
                          <td>{s.seller_profile_id.slice(0, 10)}…</td>
                          <td className="num tnum">{ARS(s.gross_amount_cents, { bare: true })}</td>
                          <td className="num tnum muted">−{ARS(s.fee_amount_cents, { bare: true })}</td>
                          <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(s.net_amount_cents, { bare: true })}</td>
                          <td><span className={`badge ${s.status}`}><span className="dot" />{s.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="col gap-4">
            <div className="card">
              <div className="card-head"><h2 className="sec-title">Información del pago</h2></div>
              <div className="card-body col gap-3">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Payment ID</span>
                  <span className="mono" style={{ fontSize: 12 }}>{d.id}</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Order ID</span>
                  <span className="mono" style={{ fontSize: 12 }}>{d.order_id}</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Buyer profile</span>
                  <span className="mono" style={{ fontSize: 12 }}>{d.buyer_profile_id}</span>
                </div>
                {d.gateway_reference && (
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Gateway ref</span>
                    <span className="mono" style={{ fontSize: 12 }}>{d.gateway_reference}</span>
                  </div>
                )}
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted">Currency</span>
                  <span>{d.currency}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><h2 className="sec-title">Comprador</h2></div>
              <div className="card-body col gap-3">
                <div className="row gap-3">
                  <span className="avatar" style={{ width: 36, height: 36, fontSize: 13 }}>BP</span>
                  <div className="col">
                    <span style={{ fontWeight: 500 }}>Buyer Profile</span>
                    <span className="muted" style={{ fontSize: 12 }}>{d.buyer_clerk_user_id ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
