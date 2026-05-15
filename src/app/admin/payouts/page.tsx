"use client"

import { useMemo, useState } from "react"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { useCreatePayout, usePayouts, useRetryPayouts } from "@/hooks/use-settlements"
import type { PayoutFilters } from "@/types/filters"

function copy(text: string) { navigator.clipboard.writeText(text) }

export default function PayoutsPage() {
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState("queue")

  const filters = useMemo<PayoutFilters>(() => ({ page, limit: 20 }), [page])

  const payoutsQuery = usePayouts(filters)
  const retryPayouts = useRetryPayouts()
  const createPayout = useCreatePayout()

  const payouts = payoutsQuery.data?.data ?? []
  const pagination = payoutsQuery.data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }

  const failed = payouts.filter((p) => p.status === "failed" || p.status === "manual_review")
  const scheduled = payouts.filter((p) => p.status === "pending")
  const inProgress = payouts.filter((p) => p.status === "in_progress")
  const completed = payouts.filter((p) => p.status === "completed")

  const totals = useMemo(() => {
    let pendingAmount = 0, inProgressAmount = 0
    for (const p of payouts) {
      if (p.status === "pending") pendingAmount += 2500000
      if (p.status === "in_progress") inProgressAmount += 404550
    }
    return { pending: scheduled.length, pendingAmount, inProgress: inProgress.length, inProgressAmount }
  }, [payouts, scheduled.length, inProgress.length])

  const handleRetryAll = async () => {
    const failedIds = failed.map((p) => p.id)
    if (failedIds.length === 0) return
    if (!confirm(`¿Reintentar ${failedIds.length} payouts fallidos?`)) return
    await retryPayouts.mutateAsync(failedIds)
  }

  const handleCreateBatch = async () => {
    const pendingIds = scheduled.map((p) => p.id)
    if (pendingIds.length === 0) return
    if (!confirm(`¿Ejecutar batch de ${pendingIds.length} payouts?`)) return
    for (const id of pendingIds) {
      await createPayout.mutateAsync(id)
    }
  }

  const exportCsv = () => {
    const header = ["id", "settlement_id", "transfer_id", "status", "attempts", "created_at"].join(",")
    const rows = payouts.map((p) =>
      [p.id, p.settlement_id, p.transfer_id ?? "", p.status, p.attempts, p.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `payouts-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell active="payouts" crumbs={["Admin", "Payouts"]}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Payouts</h1>
          <p className="page-sub">Transferencias a los <span className="kbd">collector_id</span> de cada vendedor. Se ejecutan por settlement.</p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-secondary" onClick={handleRetryAll} disabled={failed.length === 0 || retryPayouts.isPending}>
            <Icons.Retry /> Reintentar fallidos ({failed.length})
          </button>
          <button className="btn btn-primary" onClick={handleCreateBatch} disabled={scheduled.length === 0 || createPayout.isPending}>
            <Icons.Send /> Ejecutar batch ahora
          </button>
        </div>
      </div>

      <div className="grid-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="label">Pendientes</div><div className="v tnum">{totals.pending}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{ARS(totals.pendingAmount)} · próximo batch 18:00</div></div>
        <div className="card kpi"><div className="label">En curso</div><div className="v tnum">{totals.inProgress}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{ARS(totals.inProgressAmount)}</div></div>
        <div className="card kpi"><div className="label">Completados</div><div className="v tnum">{completed.length}</div><div className="row" style={{ marginTop: 6 }}><span className="delta up"><Icons.Trend />+14%</span></div></div>
        <div className="card kpi"><div className="label">Manual review</div><div className="v tnum" style={{ color: "oklch(0.50 0.18 305)" }}>{failed.length}</div><div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Requieren acción</div></div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <div className={`tab ${tab === "queue" ? "active" : ""}`} onClick={() => setTab("queue")}>Cola actual<span className="ct">{scheduled.length}</span></div>
        <div className={`tab ${tab === "attention" ? "active" : ""}`} onClick={() => setTab("attention")}>Atención<span className="ct">{failed.length}</span></div>
        <div className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Historial<span className="ct">{completed.length}</span></div>
      </div>

      {tab === "attention" && failed.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head" style={{ justifyContent: "space-between" }}>
            <div className="col">
              <h2 className="sec-title">Requieren atención</h2>
              <span className="muted" style={{ fontSize: 12, marginTop: 2 }}>Payouts fallidos o en manual review</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleRetryAll} disabled={retryPayouts.isPending}>
              <Icons.Retry /> Reintentar todos
            </button>
          </div>
          <table className="t">
            <thead>
              <tr><th>Payout</th><th>Settlement</th><th className="num">Monto</th><th>Intentos</th><th>Estado</th><th>Último error</th><th className="actions-cell"></th></tr>
            </thead>
            <tbody>
              {failed.map((p) => (
                <tr key={p.id}>
                  <td className="id"><span className="row-link">{p.id}</span></td>
                  <td className="id">{p.settlement_id.slice(0, 14)}…</td>
                  <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(2500000)}</td>
                  <td><span className="tag">{p.attempts}/3</span></td>
                  <td><span className={`badge ${p.status}`}><span className="dot" />{p.status}</span></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{p.last_error ?? "Error de transferencia"}</td>
                  <td className="actions-cell"><span className="icon-btn" onClick={() => copy(p.id)} title="Copiar ID"><Icons.Copy /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="card-head" style={{ justifyContent: "space-between" }}>
          <h2 className="sec-title">{tab === "attention" ? "Fallidos" : tab === "history" ? "Completados" : "Cola de pagos"}</h2>
          <span className="muted" style={{ fontSize: 12 }}>Próximo batch: 18:00 UTC</span>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th className="checkbox-cell"><span className="cb" /></th>
              <th>Payout ID</th>
              <th>Settlement</th>
              <th>Status</th>
              <th className="num">Monto</th>
              <th>Intentos</th>
              <th>Transfer MP</th>
              <th className="actions-cell"></th>
            </tr>
          </thead>
          <tbody>
            {payoutsQuery.isLoading ? (
              <tr><td colSpan={8}>{[0, 1, 2].map((i) => <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />)}</td></tr>
            ) : payouts.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty">
                  <div className="icon-wrap"><Icons.Send /></div>
                  <div className="t">No hay payouts</div>
                  <div className="s">Los payouts aparecen cuando los settlements se generan.</div>
                </td>
              </tr>
            ) : (
              payouts.map((p) => (
                <tr key={p.id}>
                  <td className="checkbox-cell"><span className="cb" /></td>
                  <td className="id"><span className="row-link">{p.id}</span></td>
                  <td className="id">{p.settlement_id.slice(0, 14)}…</td>
                  <td><span className={`badge ${p.status}`}><span className="dot" />{p.status}</span></td>
                  <td className="num tnum" style={{ fontWeight: 500 }}>{ARS(2500000)}</td>
                  <td><span className="tag">{p.attempts}/3</span></td>
                  <td className="id">{p.transfer_id ?? <span className="muted">—</span>}</td>
                  <td className="actions-cell"><span className="icon-btn" onClick={() => copy(p.id)} title="Copiar ID"><Icons.Copy /></span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="paginator">
          <div className="row gap-3">
            <span>Mostrando <span className="tnum">1–{payouts.length}</span> de <span className="tnum">{pagination.total}</span></span>
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
  )
}
