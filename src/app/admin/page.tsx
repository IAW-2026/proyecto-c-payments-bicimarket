"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { Delta } from "@/components/admin/delta"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { ScrollArea } from "@/components/ui/scroll-area"
import { usePayments } from "@/hooks/use-payments"
import { useSettlements } from "@/hooks/use-settlements"

function Spark({ data = [0], color = "oklch(0.50 0.155 168)" }) {
  const w = 140, h = 32
  const max = Math.max(...data), min = Math.min(...data)
  const step = (data.length > 1) ? w / (data.length - 1) : w
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

function bucketData<T>(items: T[], getDate: (item: T) => string, getValue: (item: T) => number, buckets = 12): number[] {
  if (items.length === 0) return Array(buckets).fill(0)
  const times = items.map((i) => new Date(getDate(i)).getTime())
  const min = Math.min(...times)
  const range = Math.max(...times) - min || 1
  const data = Array(buckets).fill(0)
  for (const item of items) {
    const t = new Date(getDate(item)).getTime()
    const idx = Math.min(Math.floor((t - min) / range * buckets), buckets - 1)
    data[idx] += getValue(item)
  }
  return data
}

function halfChange(items: number[]) {
  if (items.length < 2) return { pct: 0, abs: 0 }
  const mid = Math.max(1, Math.floor(items.length / 2))
  const first = items.slice(0, mid).reduce((a, b) => a + b, 0)
  const second = items.slice(mid).reduce((a, b) => a + b, 0)
  return { pct: first > 0 ? ((second - first) / first) * 100 : 0, abs: second - first }
}

export default function AdminDashboardPage() {
  const [dateRange, setDateRange] = useState("")

  const dateFrom = useMemo(() => {
    if (!dateRange) return undefined
    const now = Date.now()
    const map: Record<string, number> = { today: 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365 }
    const days = map[dateRange]
    return days !== undefined ? new Date(now - days * 86400000).toISOString() : undefined
  }, [dateRange])

  const payments = usePayments({ limit: 100, from: dateFrom })
  const settlements = useSettlements({ limit: 100, from: dateFrom })
  const isRefreshing = payments.isFetching || settlements.isFetching
  const refresh = () => { payments.refetch(); settlements.refetch() }

  const kpis = useMemo(() => {
    const pList = payments.data?.data ?? []
    const sList = settlements.data?.data ?? []

    const sortedP = [...pList].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    const sortedS = [...sList].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )

    const volumeByDate = sortedP.map((p) => p.amount_cents)
    const failedByDate = sortedP
      .filter((p) => p.status === "rejected" || p.status === "cancelled")
      .map((p) => 1)
    const pendingByDate = sortedS
      .filter((s) => s.status === "pending" || s.status === "manual_review")
      .map((s) => 1)

    const countChange = halfChange(sortedP.map(() => 1))
    const volumeChange = halfChange(volumeByDate)
    const failedChange = halfChange(failedByDate)
    const pendingChange = halfChange(pendingByDate)

    const totalVolume = sortedP.reduce((a, p) => a + p.amount_cents, 0)
    const pendingCount = sList.filter((s) => s.status === "pending" || s.status === "manual_review").length
    const failedCount = pList.filter((p) => p.status === "rejected" || p.status === "cancelled").length

    return {
      totalPayments: pList.length.toLocaleString("es-AR"),
      totalVolumeFormatted: `ARS ${(totalVolume / 100_000_000).toFixed(2).replace(".", ",")}M`,
      pendingSettlements: pendingCount,
      failedCount,

      countPct: countChange.pct,
      volPct: volumeChange.pct,
      pendingDiff: pendingChange.abs,
      failedDiff: failedChange.abs,

      countSpark: bucketData(pList, (p) => p.created_at, () => 1),
      volSpark: bucketData(pList, (p) => p.created_at, (p) => p.amount_cents),
      pendingSpark: bucketData(
        sList.filter((s) => s.status === "pending" || s.status === "manual_review"),
        (s) => s.created_at, () => 1,
      ),
      failedSpark: bucketData(
        pList.filter((p) => p.status === "rejected" || p.status === "cancelled"),
        (p) => p.created_at, () => 1,
      ),
    }
  }, [payments.data?.data, settlements.data?.data])

  const recentPayments = (payments.data?.data ?? []).slice(0, 8)
  const recentSettlements = (settlements.data?.data ?? []).slice(0, 7)

  return (
    <AdminShell active="dashboard" crumbs={["Admin", "Dashboard"]}>
      <div className="page-layout">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Resumen operativo de los últimos pagos y liquidaciones.</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={refresh} disabled={isRefreshing}>{isRefreshing ? <><Icons.Retry /> Refrescando…</> : <><Icons.Retry /> Refrescar</>}</button>
        </div>
      </div>

      <div className="filterbar">
        <span style={{ flex: 1 }} />
        <span className={`filter-chip ${dateRange === "today" ? "active" : ""}`} onClick={() => setDateRange(dateRange === "today" ? "" : "today")}>Hoy</span>
        <span className={`filter-chip ${dateRange === "7d" ? "active" : ""}`} onClick={() => setDateRange(dateRange === "7d" ? "" : "7d")}>7 días</span>
        <span className={`filter-chip ${dateRange === "30d" ? "active" : ""}`} onClick={() => setDateRange(dateRange === "30d" ? "" : "30d")}>30 días</span>
        <span className={`filter-chip ${dateRange === "90d" ? "active" : ""}`} onClick={() => setDateRange(dateRange === "90d" ? "" : "90d")}>3 meses</span>
        <span className={`filter-chip ${dateRange === "1y" ? "active" : ""}`} onClick={() => setDateRange(dateRange === "1y" ? "" : "1y")}>1 año</span>
        {dateRange && (
          <span className="filter-chip" style={{ color: "var(--destructive)", borderColor: "transparent" }} onClick={() => setDateRange("")}>
            Limpiar filtros
          </span>
        )}
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {isRefreshing ? (
          <>
            <div className="card kpi"><div className="sk" style={{ width: 120, height: 12 }} /><div className="sk" style={{ marginTop: 14, width: 80, height: 28 }} /><div className="sk" style={{ marginTop: 10, width: "100%", height: 32 }} /></div>
            <div className="card kpi"><div className="sk" style={{ width: 140, height: 12 }} /><div className="sk" style={{ marginTop: 14, width: 100, height: 28 }} /><div className="sk" style={{ marginTop: 10, width: "100%", height: 32 }} /></div>
            <div className="card kpi"><div className="sk" style={{ width: 130, height: 12 }} /><div className="sk" style={{ marginTop: 14, width: 60, height: 28 }} /><div className="sk" style={{ marginTop: 10, width: "100%", height: 32 }} /></div>
            <div className="card kpi"><div className="sk" style={{ width: 110, height: 12 }} /><div className="sk" style={{ marginTop: 14, width: 70, height: 28 }} /><div className="sk" style={{ marginTop: 10, width: "100%", height: 32 }} /></div>
          </>
        ) : (
          <>
            <div className="card kpi">
              <div className="label">Pagos procesados</div>
              <div className="v tnum">{kpis.totalPayments}</div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Delta value={kpis.countPct} type="pct" />
                <Spark data={kpis.countSpark} />
              </div>
            </div>
            <div className="card kpi">
              <div className="label">Volumen transaccionado</div>
              <div className="v tnum">{kpis.totalVolumeFormatted}</div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Delta value={kpis.volPct} type="pct" />
                <Spark data={kpis.volSpark} color="oklch(0.50 0.155 168)" />
              </div>
            </div>
            <div className="card kpi">
              <div className="label">Settlements pendientes</div>
              <div className="v tnum">{kpis.pendingSettlements}</div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Delta value={kpis.pendingDiff} type="abs" />
                <Spark data={kpis.pendingSpark} color="oklch(0.65 0.13 168)" />
              </div>
            </div>
            <div className="card kpi">
              <div className="label">Transacciones fallidas</div>
              <div className="v tnum">{kpis.failedCount}</div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <Delta value={kpis.failedDiff} type="abs" />
                <Spark data={kpis.failedSpark} color="oklch(0.55 0.18 25)" />
              </div>
            </div>
          </>
        )}
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
          <ScrollArea>
            <table className="t">
              <thead>
                <tr>
                  <th>Pago</th>
                  <th className="num">Monto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {isRefreshing ? (
                  <tr><td colSpan={4}>{[0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
                ) : recentPayments.length === 0 ? (
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
                      <td><span className={`badge ${p.status}`}><span className="dot" />{{ approved: "aprobado", pending: "pendiente", rejected: "rechazado", cancelled: "cancelado", refunded: "reembolsado" }[p.status] ?? p.status}</span></td>
                      <td className="muted">{formatDate(p.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        <div className="card">
          <div className="card-head" style={{ justifyContent: "space-between" }}>
            <div className="col">
              <h2 className="sec-title">Liquidaciones recientes</h2>
              <span className="muted" style={{ fontSize: 12, marginTop: 2 }}>Liquidaciones por vendedor</span>
            </div>
            <Link href="/admin/settlements" className="btn btn-ghost btn-sm"><Icons.Chevron /> Ver todos</Link>
          </div>
          <ScrollArea>
            <table className="t">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th className="num">Bruto</th>
                  <th className="num">Comisión</th>
                  <th className="num">Neto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {isRefreshing ? (
                  <tr><td colSpan={5}>{[0, 1, 2, 3].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
                ) : recentSettlements.length === 0 ? (
                  <tr><td colSpan={5} className="empty"><div className="t">Sin liquidaciones aún</div></td></tr>
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
                      <td><span className={`badge ${s.status}`}><span className="dot" />{{ pending: "pendiente", paid: "pagado", failed: "fallido", manual_review: "revisión manual" }[s.status] ?? s.status}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </div>
      </div>
    </AdminShell>
  )
}
