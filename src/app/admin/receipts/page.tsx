"use client"

import { useQuery } from "@tanstack/react-query"
import axios from "axios"

import { AdminShell } from "@/components/admin/admin-shell"
import { Paginator } from "@/components/admin/paginator"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { downloadCsv } from "@/lib/csv"
import Link from "next/link"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

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
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dateRange, setDateRange] = useState<string>("")
  const [sortKey, setSortKey] = useState("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [searchQ, setSearchQ] = useState("")

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["receipts", page, dateRange, searchQ],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.append("page", String(page))
      params.append("limit", "20")
      if (dateRange) {
        const now = Date.now()
        const map: Record<string, number> = { today: 0, "7d": 7, "30d": 30, "90d": 90, "1y": 365 }
        const days = map[dateRange]
        if (days !== undefined) params.append("from", new Date(now - days * 86400000).toISOString().slice(0, 10))
      }
      if (searchQ) params.append("q", searchQ)
      const { data } = await axios.get(`/api/v1/receipts?${params.toString()}`)
      return data as { data: Receipt[]; pagination: { page: number; limit: number; total: number; has_more: boolean } }
    },
  })

  const receipts = data?.data ?? []
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, has_more: false }

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(d => d === "asc" ? "desc" : "asc") }
    else { setSortKey(key); setSortDir("desc") }
  }

  const sortedReceipts = useMemo(() => {
    if (!sortKey) return receipts
    return [...receipts].sort((a, b) => {
      const va = sortKey === "amount" ? a.amount_cents : a.issued_at
      const vb = sortKey === "amount" ? b.amount_cents : b.issued_at
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [receipts, sortKey, sortDir])

  const sortIcon = (key: string) => {
    if (sortKey !== key) return <Icons.Down style={{ opacity: 0.25 }} />
    return <Icons.Down style={{ transform: sortDir === "asc" ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
  }

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
    const header = ["id", "payment_id", "receipt_number", "amount_cents", "issued_at"]
    const rows = items.map((r) => [r.id, r.payment_id, r.receipt_number, String(r.amount_cents), r.issued_at])
    downloadCsv("receipts", header, rows)
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
        <input type="search" className="search-input" placeholder="Buscar…" value={searchQ} onChange={e => { setSearchQ(e.target.value); setPage(1) }} />
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>Filtros rápidos:</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "today" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "today" ? "" : "today"); setPage(1) }}>Hoy</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "7d" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "7d" ? "" : "7d"); setPage(1) }}>7 días</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "30d" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "30d" ? "" : "30d"); setPage(1) }}>30 días</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "90d" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "90d" ? "" : "90d"); setPage(1) }}>3 meses</span>
        <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`filter-chip ${dateRange === "1y" ? "active" : ""}`} onClick={() => { setDateRange(dateRange === "1y" ? "" : "1y"); setPage(1) }}>1 año</span>
        {(dateRange || searchQ) && (
          <span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className="filter-chip" style={{ color: "var(--destructive)", borderColor: "transparent" }} onClick={() => { setDateRange(""); setSearchQ(""); setPage(1) }}>
            Limpiar filtros
          </span>
        )}
      </div>

      <div className="card">
        <ScrollArea>
          <table className="t">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <span role="checkbox" aria-checked={selected.size > 0 ? (selected.size === receipts.length ? true : "mixed") : false} tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`cb ${selected.size > 0 ? (selected.size === receipts.length ? "checked" : "indeterminate") : ""}`} onClick={selectAll}>
                    {selected.size === receipts.length ? <Icons.Check /> : selected.size > 0 ? <Icons.Minus /> : null}
                  </span>
                </th>
                <th>Comprobante</th>
                <th>Pago</th>
                <th className="num"><span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className="sort-h" onClick={() => handleSort("amount")}>Monto {sortIcon("amount")}</span></th>
                <th><span role="button" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className="sort-h" onClick={() => handleSort("date")}>Emitido {sortIcon("date")}</span></th>
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
                sortedReceipts.map((r) => (
                  <tr key={r.id} className={selected.has(r.id) ? "row-selected" : ""} onClick={() => router.push(`/admin/receipts/${r.id}`)} style={{ cursor: "pointer" }}>
                    <td className="checkbox-cell" onClick={e => e.stopPropagation()}>
                      <span role="checkbox" aria-checked={selected.has(r.id)} tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} className={`cb ${selected.has(r.id) ? "checked" : ""}`} onClick={() => toggleSelect(r.id)}>
                        {selected.has(r.id) ? <Icons.Check /> : null}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <Link href={`/admin/receipts/${r.id}`} className="col" style={{ textDecoration: "none" }}>
                        <span className="mono" style={{ fontSize: 12.5, fontWeight: 500, color: "var(--primary)" }}>{r.receipt_number}</span>
                        <span className="muted mono" style={{ fontSize: 11 }}>{r.id}</span>
                      </Link>
                    </td>
                    <td className="id">{r.payment_id.slice(0, 18)}…</td>
                    <td className="num tnum">{ARS(r.amount_cents)}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(r.issued_at)}</td>
                    <td className="actions-cell" onClick={e => e.stopPropagation()}>
                      <span className="icon-btn" onClick={() => handleCopy(r.id)} aria-label="Copiar ID" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} title="Copiar ID"><Icons.Copy /></span>
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
