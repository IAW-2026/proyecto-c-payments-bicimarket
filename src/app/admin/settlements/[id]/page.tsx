"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { useCreatePayout, useSettlement } from "@/hooks/use-settlements"
import { useToast } from "@/hooks/use-toast"

export default function SettlementDetailPage() {
  const { toast } = useToast()
  const params = useParams<{ id: string }>()
  const settlementId = Array.isArray(params.id) ? params.id[0] : params.id

  const settlement = useSettlement(settlementId)
  const createPayout = useCreatePayout()

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  const downloadReport = () => {
    if (!settlement.data) return
    const d = settlement.data
    const header = ["field", "value"].join(",")
    const rows = [
      ["id", d.id],
      ["payment_id", d.payment_id],
      ["seller_profile_id", d.seller_profile_id],
      ["gross_amount_cents", String(d.gross_amount_cents)],
      ["fee_amount_cents", String(d.fee_amount_cents)],
      ["net_amount_cents", String(d.net_amount_cents)],
      ["status", d.status],
      ["created_at", d.created_at],
    ].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `settlement-${d.id.slice(0, 14)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (settlement.isLoading || !settlement.data) {
    return (
      <AdminShell active="settlements" crumbs={["Admin", "Liquidaciones", "detalle"]}>
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

  const d = settlement.data
  const feePct = d.gross_amount_cents > 0 ? Math.round((d.fee_amount_cents / d.gross_amount_cents) * 100) : 0
  const netPct = 100 - feePct

  return (
    <AdminShell active="settlements" crumbs={["Admin", "Liquidaciones", `${d.id.slice(0, 14)}…`]}>
      <div className="page-layout">
        <div className="detail-header">
          <div className="col gap-3">
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{d.id}</span>
              <span className="icon-btn" onClick={() => handleCopy(d.id)} aria-label="Copiar ID" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} title="Copiar ID"><Icons.Copy /></span>
              <span className={`badge ${d.status} badge-lg`}><span className="dot" />{{ pending: "pendiente", paid: "pagado", failed: "fallido", manual_review: "revisión manual", cancelled: "cancelado" }[d.status] ?? d.status}</span>
            </div>
            <div className="row gap-3" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
              <h1 className="page-title" style={{ fontSize: 30, margin: 0 }}>{ARS(d.net_amount_cents)}</h1>
              <span className="muted" style={{ fontSize: 14 }}>Neto a pagar al vendedor</span>
            </div>
            <div className="row gap-4 muted" style={{ fontSize: 13, flexWrap: "wrap" }}>
              <span>Pago <Link href={`/admin/payments/${d.payment_id}`} className="mono" style={{ color: "var(--primary)", fontWeight: 500 }}>{d.payment_id.slice(0, 18)}… →</Link></span>
              <span>·</span>
              <span>Vendedor <span className="mono" style={{ color: "var(--primary)", fontWeight: 500 }}>{d.seller_profile_id} →</span></span>
            </div>
          </div>
          <div className="btn-group">
            <button className="btn btn-secondary" onClick={downloadReport}><Icons.Download /> Exportar</button>
            {d.status === "pending" && (!d.payouts || d.payouts.length === 0) && (
              <button className="btn btn-primary" onClick={async () => { try { await createPayout.mutateAsync(d.id); toast({ description: "Pago generado exitosamente" }) } catch { toast({ description: "Error al generar el pago" }) } }} disabled={createPayout.isPending}>
                {createPayout.isPending ? "Generando…" : <><Icons.Send /> Generar pago</>}
              </button>
            )}
          </div>
        </div>

        <div className="page-body-scroll" style={{ paddingTop: 16 }}>
          <div className="detail-grid">
            <div className="col gap-4">
              <div className="card">
                <div className="card-head"><h2 className="sec-title">Cálculo de liquidación</h2></div>
                <div className="card-body col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Monto bruto</span>
                    <span className="tnum">{ARS(d.gross_amount_cents)}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Comisión marketplace <span className="tag">{feePct}%</span></span>
                    <span className="tnum" style={{ color: "oklch(0.55 0.18 25)" }}>−{ARS(d.fee_amount_cents)}</span>
                  </div>
                  <div className="divider" style={{ margin: "4px 0" }} />
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>Net a pagar</span>
                    <span className="tnum" style={{ fontSize: 20, fontWeight: 600, color: "var(--primary)" }}>{ARS(d.net_amount_cents)}</span>
                  </div>
                  <div className="bar" style={{ marginTop: 10, height: 14 }}>
                    <div style={{ width: `${netPct}%`, background: "oklch(0.50 0.155 168)" }} />
                    <div style={{ width: `${feePct}%`, background: "oklch(0.55 0.18 25)" }} />
                  </div>
                  <div className="row gap-3" style={{ fontSize: 12, marginTop: 4, flexWrap: "wrap" }}>
                    <span className="row gap-2"><span style={{ width: 8, height: 8, borderRadius: 2, background: "oklch(0.50 0.155 168)" }} /><span className="muted">Net del seller {netPct}%</span></span>
                    <span className="row gap-2"><span style={{ width: 8, height: 8, borderRadius: 2, background: "oklch(0.55 0.18 25)" }} /><span className="muted">Comisión {feePct}%</span></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col gap-4">
              <div className="card">
                <div className="card-head"><h2 className="sec-title">Vendedor</h2></div>
                <div className="card-body col gap-3">
                  <div className="row gap-3">
                    <span className="avatar" style={{ width: 38, height: 38, fontSize: 13, background: "oklch(0.50 0.155 168)" }}>VE</span>
                    <div className="col">
                      <span style={{ fontWeight: 500 }}>Vendedor</span>
                      <span className="muted" style={{ fontSize: 12 }}>{d.seller_profile_id}</span>
                    </div>
                    <span className="badge active" style={{ marginLeft: "auto" }}><span className="dot" />activo</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Perfil del vendedor</span>
                    <span className="mono" style={{ fontSize: 12 }}>{d.seller_profile_id}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h2 className="sec-title">Detalles</h2></div>
                <div className="card-body col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Bruto</span>
                    <span className="tnum">{ARS(d.gross_amount_cents)}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Comisión</span>
                    <span className="tnum">{ARS(d.fee_amount_cents)}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Neto</span>
                    <span className="tnum" style={{ fontWeight: 500 }}>{ARS(d.net_amount_cents)}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Creado</span>
                    <span>{formatDate(d.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
