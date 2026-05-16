"use client"

import { useQuery } from "@tanstack/react-query"
import axios from "axios"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { useState } from "react"

interface Receipt {
  id: string
  payment_id: string
  receipt_number: string
  amount_cents: number
  status: string
  issued_at: string
  download_url?: string
}

export default function ReceiptsPage() {
  const [page, setPage] = useState(1)
  const [dateRange, setDateRange] = useState<string>("")

  const { data, isLoading } = useQuery({
    queryKey: ["receipts", page, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append("page", String(page))
      params.append("limit", "20")
      if (dateRange) params.append("from", new Date(Date.now() - Number(dateRange) * 86400000).toISOString().slice(0, 10))
      const { data } = await axios.get(`/api/v1/receipts?${params.toString()}`)
      return data as { data: Receipt[]; pagination: { page: number; limit: number; total: number; has_more: boolean } }
    },
  })

  const receipts = data?.data ?? []
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }

  const copy = (text: string) => navigator.clipboard.writeText(text)

  const exportCsv = () => {
    const header = ["id", "payment_id", "receipt_number", "amount_cents", "issued_at"].join(",")
    const rows = receipts.map((r) =>
      [r.id, r.payment_id, r.receipt_number, r.amount_cents, r.issued_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `receipts-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell active="receipts" crumbs={["Admin", "Receipts"]}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="page-sub">Comprobantes fiscales emitidos por cada cobro. Se generan automáticamente tras la aprobación del pago y están disponibles en PDF.</p>
        </div>
        <div className="row gap-2">
          <button className="btn btn-secondary" onClick={exportCsv}><Icons.Download /> Exportar</button>
        </div>
      </div>

      <div className="filterbar">
        <Icons.Filter />
        <span className={`filter-chip ${dateRange === "7" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "7" ? "" : "7"); setPage(1) }}>7 días</span>
        <span className={`filter-chip ${dateRange === "30" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "30" ? "" : "30"); setPage(1) }}>30 días</span>
        <span className={`filter-chip ${dateRange === "90" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "90" ? "" : "90"); setPage(1) }}>90 días</span>
        {dateRange && (
          <span className="filter-chip" style={{ color: "var(--destructive)", borderColor: "transparent" }} onClick={() => { setDateRange(""); setPage(1) }}>
            Limpiar filtros
          </span>
        )}
        <span style={{ flex: 1 }} />
      </div>

      <div className="card">
        <table className="t">
          <thead>
            <tr>
              <th className="checkbox-cell"><span className="cb" /></th>
              <th>Comprobante</th>
              <th>Payment</th>
              <th className="num">Monto</th>
              <th>Estado</th>
              <th>Emitido</th>
              <th className="actions-cell"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />
                  ))}
                </td>
              </tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  <div className="icon-wrap"><Icons.Receipt /></div>
                  <div className="t">No hay comprobantes</div>
                  <div className="s">Los comprobantes se generan al aprobar pagos con Mercado Pago.</div>
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id}>
                  <td className="checkbox-cell"><span className="cb" /></td>
                  <td>
                    <div className="col">
                      <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{r.receipt_number}</span>
                      <span className="muted mono" style={{ fontSize: 11 }}>{r.id}</span>
                    </div>
                  </td>
                  <td className="id">{r.payment_id.slice(0, 18)}…</td>
                  <td className="num tnum">{ARS(r.amount_cents)}</td>
                  <td><span className={`badge ${r.status === "generated" ? "approved" : "pending"}`}><span className="dot" />{r.status}</span></td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(r.issued_at)}</td>
                  <td className="actions-cell">
                    <span className="icon-btn" onClick={() => copy(r.id)} title="Copiar ID"><Icons.Copy /></span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="paginator">
          <div className="row gap-3">
            <span>Mostrando <span className="tnum">1–{receipts.length}</span> de <span className="tnum">{pagination.total}</span></span>
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
