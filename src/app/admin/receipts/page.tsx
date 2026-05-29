"use client"

import { useQuery } from "@tanstack/react-query"
import axios from "axios"

import { AdminShell } from "@/components/admin/admin-shell"
import { Paginator } from "@/components/admin/paginator"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useState } from "react"

interface Receipt {
  id: string
  payment_id: string
  receipt_number: string
  amount_cents: number
  issued_at: string
  download_url?: string
}

export default function ReceiptsPage() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dateRange, setDateRange] = useState<string>("")

  const { data, isLoading, isFetching, refetch } = useQuery({
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

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const selectAll = () => {
    if (selected.size === receipts.length) setSelected(new Set())
    else setSelected(new Set(receipts.map((r) => r.id)))
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  const exportCsv = (onlySelected = false) => {
    const items = onlySelected ? receipts.filter((r) => selected.has(r.id)) : receipts
    const header = ["id", "payment_id", "receipt_number", "amount_cents", "issued_at"].join(",")
    const rows = items.map((r) =>
      [r.id, r.payment_id, r.receipt_number, r.amount_cents, r.issued_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `receipts-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <AdminShell active="receipts" crumbs={["Admin", "Comprobantes"]}>
      <div className="page-layout">
        <div className="page-header">
        <div>
          <h1 className="page-title">Comprobantes</h1>
          <p className="page-sub">Comprobantes fiscales emitidos por cada cobro. Se generan automáticamente tras la aprobación del pago y están disponibles en PDF.</p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => refetch()} disabled={isFetching}>{isFetching ? <><Icons.Retry /> Refrescando…</> : <><Icons.Retry /> Refrescar</>}</button>
          <button className="btn btn-secondary" onClick={() => exportCsv()}><Icons.Download /> Exportar</button>
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
        <ScrollArea>
          <table className="t">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <span className={`cb ${selected.size > 0 ? (selected.size === receipts.length ? "checked" : "indeterminate") : ""}`} onClick={selectAll}>
                    {selected.size === receipts.length ? <Icons.Check /> : selected.size > 0 ? <Icons.Minus /> : null}
                  </span>
                </th>
                <th>Comprobante</th>
                <th>Pago</th>
                <th className="num">Monto</th>
                <th>Emitido</th>
                <th className="actions-cell"></th>
              </tr>
            </thead>
            <tbody>
              {isFetching ? (
                <tr>
                    <td colSpan={6}>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="sk" style={{ width: "100%", height: 20, margin: 8 }} />
                    ))}
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                    <td colSpan={6} className="empty">
                    <div className="icon-wrap"><Icons.Receipt /></div>
                    <div className="t">No hay comprobantes</div>
                    <div className="s">Los comprobantes se generan al aprobar pagos con Mercado Pago.</div>
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id} className={selected.has(r.id) ? "row-selected" : ""}>
                    <td className="checkbox-cell">
                      <span className={`cb ${selected.has(r.id) ? "checked" : ""}`} onClick={() => toggleSelect(r.id)}>
                        {selected.has(r.id) ? <Icons.Check /> : null}
                      </span>
                    </td>
                    <td>
                      <Link href={`/admin/receipts/${r.id}`} className="col" style={{ textDecoration: "none" }}>
                        <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--primary)" }}>{r.receipt_number}</span>
                        <span className="muted mono" style={{ fontSize: 11 }}>{r.id}</span>
                      </Link>
                    </td>
                    <td className="id">{r.payment_id.slice(0, 18)}…</td>
                    <td className="num tnum">{ARS(r.amount_cents)}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(r.issued_at)}</td>
                    <td className="actions-cell">
                      <span className="icon-btn" onClick={() => handleCopy(r.id)} title="Copiar ID"><Icons.Copy /></span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
        <Paginator
          page={page}
          total={pagination.total}
          pageSize={20}
          hasMore={pagination.has_more}
          onPrev={() => setPage((c) => Math.max(1, c - 1))}
          onNext={() => setPage((c) => c + 1)}
        />
      </div>
      {selected.size > 0 && (
        <div className="row gap-3 muted" style={{ marginTop: 14, fontSize: 12.5, flexWrap: "wrap" }}>
          <span>{selected.size} seleccionados</span>
          <span>·</span>
          <button className="btn btn-secondary btn-sm" onClick={() => exportCsv(true)}>Exportar selección</button>
        </div>
      )}
      </div>
    </AdminShell>
  )
}
