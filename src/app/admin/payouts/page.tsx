"use client"

import { useMemo, useState } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { Paginator } from "@/components/admin/paginator"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { usePayouts } from "@/hooks/use-settlements"
import { useToast } from "@/hooks/use-toast"
import type { PayoutFilters } from "@/types/filters"

function copy(text: string) { navigator.clipboard.writeText(text) }

export default function PayoutsPage() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState("queue")

  const filters = useMemo<PayoutFilters>(() => ({ page, limit: 20 }), [page])

  const payoutsQuery = usePayouts(filters)

  const payouts = payoutsQuery.data?.data ?? []
  const pagination = payoutsQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }

  const failed = payouts.filter((p) => p.status === "failed" || p.status === "manual_review")
  const scheduled = payouts.filter((p) => p.status === "pending")
  const inProgress = payouts.filter((p) => p.status === "in_progress")
  const completed = payouts.filter((p) => p.status === "completed")

  const displayedPayouts = tab === "attention" ? failed : tab === "history" ? completed : [...scheduled, ...inProgress]

  const totals = useMemo(() => {
    let pendingAmount = 0, inProgressAmount = 0
    for (const p of payouts) {
      const amount = p.settlement?.gross_amount_cents ?? 0
      if (p.status === "pending") pendingAmount += amount
      if (p.status === "in_progress") inProgressAmount += amount
    }
    return { pending: scheduled.length, pendingAmount, inProgress: inProgress.length, inProgressAmount }
  }, [payouts, scheduled.length, inProgress.length])

  const handleCopy = (text: string) => {
    copy(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  const exportCsv = () => {
    const header = ["id", "settlement_id", "status", "created_at"].join(",")
    const rows = payouts.map((p) =>
      [p.id, p.settlement_id, p.status, p.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `payouts-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell active="payouts" crumbs={["Admin", "Payouts"]}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payouts</h1>
          <p className="page-sub">Registro de payouts generados. Finanzas los procesa externamente contra Mercado Pago.</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={exportCsv}><Icons.Download /> Exportar</button>
        </div>
      </div>

      <div className="grid-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Pendientes</div><div className="v tnum">{totals.pending}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{ARS(totals.pendingAmount)}</div></div>
        <div className="card kpi"><div className="label">En curso</div><div className="v tnum">{totals.inProgress}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{ARS(totals.inProgressAmount)}</div></div>
        <div className="card kpi"><div className="label">Completados</div><div className="v tnum">{completed.length}</div></div>
        <div className="card kpi"><div className="label">Manual review</div><div className="v tnum" style={{ color: "oklch(0.50 0.18 305)" }}>{failed.length}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Requieren acción</div></div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <div className={`tab ${tab === "queue" ? "active" : ""}`} onClick={() => setTab("queue")}>Cola actual<span className="ct">{scheduled.length}</span></div>
        <div className={`tab ${tab === "attention" ? "active" : ""}`} onClick={() => setTab("attention")}>Atención<span className="ct">{failed.length}</span></div>
        <div className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Historial<span className="ct">{completed.length}</span></div>
      </div>

      <div className="card">
        <div className="card-head" style={{ justifyContent: "space-between" }}>
          <h2 className="sec-title">{tab === "attention" ? "Fallidos" : tab === "history" ? "Completados" : "Cola de pagos"}</h2>
        </div>
        <div className="table-wrapper">
          <table className="t">
            <thead>
              <tr>
                <th className="checkbox-cell"><span className="cb" /></th>
                <th>Payout ID</th>
                <th>Settlement</th>
                <th>Status</th>
                <th className="num">Monto</th>
                <th className="actions-cell"></th>
              </tr>
            </thead>
            <tbody>
                {payoutsQuery.isLoading ? (
                  <tr><td colSpan={6}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
                ) : displayedPayouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      <div className="icon-wrap"><Icons.Send /></div>
                      <div className="t">No hay payouts</div>
                      <div className="s">Los payouts aparecen cuando los settlements se generan.</div>
                    </td>
                  </tr>
                ) : (
                  displayedPayouts.map((p) => (
                  <tr key={p.id}>
                    <td className="checkbox-cell"><span className="cb" /></td>
                    <td className="id"><span className="row-link">{p.id}</span></td>
                    <td className="id">{p.settlement_id.slice(0, 14)}…</td>
                    <td><span className={`badge ${p.status}`}><span className="dot" />{p.status}</span></td>
                    <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(p.settlement?.gross_amount_cents ?? 0)}</td>
                    <td className="actions-cell"><span className="icon-btn" onClick={() => handleCopy(p.id)} title="Copiar ID"><Icons.Copy /></span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginator
          page={page}
          total={displayedPayouts.length}
          pageSize={20}
          hasMore={pagination.has_more}
          onPrev={() => setPage((c) => Math.max(1, c - 1))}
          onNext={() => setPage((c) => c + 1)}
        />
      </div>
    </AdminShell>
  )
}
