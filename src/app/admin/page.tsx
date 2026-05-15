"use client"

import Link from "next/link"
import { useMemo } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { usePayments } from "@/hooks/use-payments"
import { useSettlements } from "@/hooks/use-settlements"

function Spark({ data = [3, 4, 3, 5, 6, 5, 7, 6, 8, 9, 8, 10], color = "oklch(0.50 0.155 168)" }) {
  const w = 140, h = 32
  const max = Math.max(...data), min = Math.min(...data)
  const step = w / (data.length - 1)
  const norm = (v: number) => h - ((v - min) / ((max - min) || 1)) * (h - 4) - 2
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${norm(v)}`).join(" ")
  const area = `${path} L ${w} ${h} L 0 ${h} Z`
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="sparkgrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkgrad)" />
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  )
}

export default function AdminDashboardPage() {
  const payments = usePayments({ limit: 100 })
  const settlements = useSettlements({ limit: 100 })

  const kpis = useMemo(() => {
    const pList = payments.data?.data ?? []
    const sList = settlements.data?.data ?? []

    const totalPayments = pList.length
    const totalVolume = pList.reduce((a, p) => a + p.amount_cents, 0)
    const failedCount = pList.filter((p) => p.status === "rejected" || p.status === "cancelled").length
    const pendingSettlements = sList.filter((s) => s.status === "pending" || s.status === "manual_review").length

    return {
      totalPayments: totalPayments.toLocaleString("es-AR"),
      totalVolume: totalVolume,
      failedCount,
      pendingSettlements,
      totalVolumeFormatted: `ARS ${(totalVolume / 100_000_000).toFixed(2).replace(".", ",")}M`,
    }
  }, [payments.data?.data, settlements.data?.data])

  const recentPayments = (payments.data?.data ?? []).slice(0, 8)
  const recentSettlements = (settlements.data?.data ?? []).slice(0, 7)

  return (
    <AdminShell active="dashboard" crumbs={["Admin", "Dashboard"]}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Payments Dashboard</h1>
          <p className="page-sub">Resumen operativo de los últimos pagos y liquidaciones.</p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-secondary"><Icons.Calendar /> Últimos 30 días</button>
          <button className="btn btn-secondary"><Icons.Download /> Exportar</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card kpi">
          <div className="label">Pagos procesados</div>
          <div className="v tnum">{kpis.totalPayments}</div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="delta up"><Icons.Trend />+12.4%</span>
            <Spark data={[3, 4, 3, 5, 6, 5, 7, 6, 8, 9, 8, 10]} />
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Volumen transaccionado</div>
          <div className="v tnum">{kpis.totalVolumeFormatted}</div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="delta up"><Icons.Trend />+8.1%</span>
            <Spark data={[4, 5, 5, 6, 7, 6, 8, 9, 8, 10, 11, 12]} />
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Settlements pendientes</div>
          <div className="v tnum">{kpis.pendingSettlements}</div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="delta down"><Icons.TrendDown />−4</span>
            <Spark data={[8, 9, 9, 8, 7, 8, 7, 6, 7, 6, 5, 4]} color="oklch(0.65 0.13 168)" />
          </div>
        </div>
        <div className="card kpi">
          <div className="label">Transacciones fallidas</div>
          <div className="v tnum">{kpis.failedCount}</div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="delta down"><Icons.TrendDown />+5</span>
            <Spark data={[1, 2, 1, 2, 3, 2, 3, 2, 3, 4, 3, 5]} color="oklch(0.55 0.18 25)" />
          </div>
        </div>
      </div>

      <div className="grid-2 gap-4">
        <div className="card">
          <div className="card-head" style={{ justifyContent: "space-between" }}>
            <div className="col">
              <h2 className="sec-title">Pagos recientes</h2>
              <span className="muted" style={{ fontSize: 12, marginTop: 2 }}>Últimos {recentPayments.length} movimientos</span>
            </div>
            <Link href="/admin/payments" className="btn btn-ghost btn-sm"><Icons.Chevron /> Ver todos</Link>
          </div>
          <table className="t">
            <thead>
              <tr>
                <th>Payment</th>
                <th className="num">Monto</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.length === 0 ? (
                <tr><td colSpan={4} className="empty"><div className="t">Sin pagos aún</div></td></tr>
              ) : (
                recentPayments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="col">
                        <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{p.id.slice(0, 14)}…</span>
                        <span className="muted mono" style={{ fontSize: 11 }}>{p.order_id.slice(0, 14)}…</span>
                      </div>
                    </td>
                    <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(p.amount_cents)}</td>
                    <td><span className={`badge ${p.status}`}><span className="dot" />{p.status}</span></td>
                    <td style={{ textAlign: "right" }} className="muted">{formatDate(p.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head" style={{ justifyContent: "space-between" }}>
            <div className="col">
              <h2 className="sec-title">Settlements recientes</h2>
              <span className="muted" style={{ fontSize: 12, marginTop: 2 }}>Liquidaciones por vendedor</span>
            </div>
            <Link href="/admin/settlements" className="btn btn-ghost btn-sm"><Icons.Chevron /> Ver todos</Link>
          </div>
          <table className="t">
            <thead>
              <tr>
                <th>Seller</th>
                <th className="num">Gross</th>
                <th className="num">Fee</th>
                <th className="num">Net</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {recentSettlements.length === 0 ? (
                <tr><td colSpan={5} className="empty"><div className="t">Sin settlements aún</div></td></tr>
              ) : (
                recentSettlements.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="col">
                        <span style={{ fontWeight: 500 }}>{s.seller_profile_id.slice(0, 10)}…</span>
                        <span className="muted mono" style={{ fontSize: 11 }}>{s.id.slice(0, 14)}…</span>
                      </div>
                    </td>
                    <td className="num tnum">{ARS(s.gross_amount_cents, { bare: true })}</td>
                    <td className="num tnum muted">−{ARS(s.fee_amount_cents, { bare: true })}</td>
                    <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(s.net_amount_cents, { bare: true })}</td>
                    <td><span className={`badge ${s.status}`}><span className="dot" />{s.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  )
}
