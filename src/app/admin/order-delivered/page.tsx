"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import type { Payment } from "@/types/payments"

export default function OrderDeliveredPage() {
  const { toast } = useToast()
  const [orderId, setOrderId] = useState("")
  const [payment, setPayment] = useState<Payment | null>(null)
  const [settlers, setSettlers] = useState<Array<{ seller_profile_id: string; order_seller_group_id: string; gross: number }>>([])
  const [confirming, setConfirming] = useState(false)
  const [settling, setSettling] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const searchMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.get(`/api/v1/payments?orderId=${encodeURIComponent(orderId)}&limit=1`)
      return data
    },
    onSuccess: (res) => {
      const payments = res.data ?? []
      if (payments.length === 0) {
        setPayment(null)
        setSettlers([])
        setResult("No se encontró un pago para esa orden.")
        return
      }
      const p = payments[0] as Payment
      setPayment(p)
      setResult(null)

      const summary = (p as any).items_summary
      if (Array.isArray(summary)) {
        setSettlers(summary.map((s: any) => ({
          seller_profile_id: s.seller_profile_id,
          order_seller_group_id: s.order_seller_group_id || `osg_test_${Date.now()}`,
          gross: (s.subtotal_cents || 0) + (s.shipping_cost_cents || 0),
        })))
      } else {
        setSettlers([])
      }
    },
    onError: (err: Error) => {
      setResult(`Error: ${err.message}`)
    },
  })

  const confirmMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { data } = await axios.patch(`/api/v1/payments/${paymentId}/confirm`, {
        status: "approved",
        reason: "Confirmado desde order-delivered (testing)",
      })
      return data
    },
    onSuccess: () => {
      toast({ description: "Pago confirmado como aprobado" })
      if (payment) searchMutation.mutate()
    },
    onError: (err: Error) => {
      toast({ description: `Error al confirmar: ${err.message}` })
    },
  })

  const deliverMutation = useMutation({
    mutationFn: async (sellerInfo: { seller_profile_id: string; order_seller_group_id: string }) => {
      if (!payment) throw new Error("No payment selected")
      const { data } = await axios.post("/api/v1/internal/shipment-delivered", {
        shipment_id: `shp_test_${Date.now()}`,
        order_id: payment.order_id,
        order_seller_group_id: sellerInfo.order_seller_group_id,
        sales_order_id: `sor_test_${Date.now()}`,
        seller_profile_id: sellerInfo.seller_profile_id,
        delivered_at: new Date().toISOString(),
      })
      return data
    },
    onSuccess: (res) => {
      toast({ description: `Liquidación creada: ${res.settlement_id}` })
      setResult(`Settlement creado: ${res.settlement_id}`)
      if (payment) searchMutation.mutate()
    },
    onError: (err: Error) => {
      toast({ description: `Error al crear liquidación: ${err.message}` })
      setResult(`Error: ${err.message}`)
    },
  })

  const paymentStatusLabels: Record<string, string> = {
    approved: "aprobado", pending: "pendiente", rejected: "rechazado", cancelled: "cancelado", refunded: "reembolsado",
  }

  return (
    <AdminShell active="order-delivered" crumbs={["Admin", "Order Delivered (testing)"]}>
      <div className="page-layout">
        <div className="page-header">
          <div>
            <h1 className="page-title">Order Delivered</h1>
            <p className="page-sub">Simular entrega de orden para testing. Buscá un pago por order_id, confirmalo como pagado y creá su liquidación.</p>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: "12px 16px" }}>
            <div className="row gap-3" style={{ alignItems: "center" }}>
              <div className="row gap-2" style={{ flex: "0 0 300px", alignItems: "center" }}>
                <input
                  id="order-id"
                  type="text"
                  className="input"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="ord_..."
                  aria-label="Order ID"
                  style={{ flex: 1, fontFamily: "var(--font-geist-mono)", fontSize: 13, height: 34 }}
                  onKeyDown={(e) => { if (e.key === "Enter") searchMutation.mutate() }}
                />
                <button className="btn btn-primary" onClick={() => searchMutation.mutate()} disabled={searchMutation.isPending || !orderId} style={{ height: 34, paddingInline: 12 }}>
                  {searchMutation.isPending ? <Icons.Retry size={14} /> : <Icons.Search size={14} />}
                </button>
                {result && !payment && (
                  <span className="muted" style={{ fontSize: 11 }}>{result}</span>
                )}
              </div>

              {payment && (
                <div className="row gap-3" style={{ flex: 1, alignItems: "center", borderLeft: "1px solid var(--border)", paddingLeft: 12 }}>
                  <span className={`badge ${payment.status}`}><span className="dot" />{paymentStatusLabels[payment.status] ?? payment.status}</span>
                  <span className="tnum" style={{ fontWeight: 600, fontSize: 14 }}>{ARS(payment.amount_cents)}</span>
                  <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>ID: <span className="mono">{payment.id.slice(0, 12)}</span></span>
                  <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>Orden: <span className="mono">{payment.order_id}</span></span>
                  <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>Creado: {formatDate(payment.created_at)}</span>
                  {payment.status === "pending" && (
                    <button className="btn btn-primary btn-sm" onClick={() => confirmMutation.mutate(payment.id)} disabled={confirmMutation.isPending} style={{ height: 28, fontSize: 12 }}>
                      {confirmMutation.isPending ? "Confirmando" : "Marcar como pagado"}
                    </button>
                  )}
                  {payment.status === "approved" && settlers.length === 0 && (
                    <span className="muted" style={{ fontSize: 11 }}>Sin vendedores</span>
                  )}
                  {result && payment && (
                    <span className="muted" style={{ fontSize: 11, color: "var(--success)" }}>{result}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {payment && payment.status === "approved" && settlers.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-head">
              <h2 className="sec-title">Crear liquidación</h2>
            </div>
            <div className="card-body" style={{ padding: 20 }}>
              <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Seleccioná el vendedor para el cual se creará la liquidación.
              </p>
              <ScrollArea>
                <table className="t">
                  <thead>
                    <tr>
                      <th>Seller Profile ID</th>
                      <th className="num">Bruto</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlers.map((s) => (
                      <tr key={s.seller_profile_id}>
                        <td className="id" style={{ maxWidth: 280, wordBreak: "break-all" }}>{s.seller_profile_id}</td>
                        <td className="num tnum">{ARS(s.gross)}</td>
                        <td className="actions-cell">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => deliverMutation.mutate(s)}
                            disabled={deliverMutation.isPending}
                          >
                            {deliverMutation.isPending ? "Creando" : "Crear liquidación"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
