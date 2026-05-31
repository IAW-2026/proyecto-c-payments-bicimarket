"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { AdminShell } from "@/components/admin/admin-shell"
import { Icons } from "@/lib/icons"
import { ARS, formatDate } from "@/lib/currency"
import { useReceipt } from "@/hooks/use-receipts"
import { useToast } from "@/hooks/use-toast"

export default function ReceiptDetailPage() {
  const { toast } = useToast()
  const params = useParams<{ id: string }>()
  const receiptId = Array.isArray(params.id) ? params.id[0] : params.id

  const receipt = useReceipt(receiptId)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ description: "ID copiado al portapapeles" })
  }

  if (receipt.isLoading || !receipt.data) {
    return (
      <AdminShell active="receipts" crumbs={["Admin", "Comprobantes", "detalle"]}>
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

  const d: any = receipt.data

  return (
    <AdminShell active="receipts" crumbs={["Admin", "Comprobantes", `${d.receipt_number}`]}>
      <div className="page-layout">
        <div className="detail-header">
          <div className="col gap-3">
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{d.receipt_number}</span>
              <span className="icon-btn" onClick={() => handleCopy(d.id)} aria-label="Copiar ID" tabIndex={0} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); e.currentTarget.click() } }} title="Copiar ID"><Icons.Copy /></span>
              <span className="badge approved badge-lg"><span className="dot" />emitido</span>
            </div>
            <div className="row gap-3" style={{ alignItems: "baseline", flexWrap: "wrap" }}>
              <h1 className="page-title" style={{ fontSize: 30, margin: 0 }}>{ARS(d.amount_cents)}</h1>
              <span className="muted" style={{ fontSize: 14 }}>Comprobante fiscal</span>
            </div>
            <div className="row gap-4 muted" style={{ fontSize: 13, flexWrap: "wrap" }}>
              <span>Pago <Link href={`/admin/payments/${d.payment_id}`} className="mono" style={{ color: "var(--primary)", fontWeight: 500 }}>{d.payment_id.slice(0, 18)}… →</Link></span>
              <span>·</span>
              <span>Emitido {formatDate(d.issued_at)}</span>
            </div>
          </div>
          <div className="btn-group">
            {d.receipt_url && (
              <a href={d.receipt_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary"><Icons.Download /> Descargar PDF</a>
            )}
            <button className="btn btn-secondary" onClick={() => handleCopy(d.id)}><Icons.Copy /> Copiar ID</button>
          </div>
        </div>

        <div className="page-body-scroll" style={{ paddingTop: 16 }}>
          <div className="detail-grid">
            <div className="col gap-4">
              <div className="card">
                <div className="card-head"><h2 className="sec-title">Detalle del comprobante</h2></div>
                <div className="card-body col gap-3">
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Número de comprobante</span>
                    <span className="mono" style={{ fontWeight: 500 }}>{d.receipt_number}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">ID interno</span>
                    <span className="mono" style={{ fontSize: 12 }}>{d.id}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Monto</span>
                    <span className="tnum" style={{ fontWeight: 500 }}>{ARS(d.amount_cents)}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Emitido el</span>
                    <span>{formatDate(d.issued_at)}</span>
                  </div>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="muted">Creado el</span>
                    <span>{formatDate(d.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col gap-4">
              <div className="card">
                <div className="card-head"><h2 className="sec-title">Acciones</h2></div>
                <div className="card-body col gap-3">
                  {d.receipt_url ? (
                    <a href={d.receipt_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ width: "100%" }}>
                      <Icons.Download /> Descargar PDF
                    </a>
                  ) : (
                    <p className="muted" style={{ fontSize: 13 }}>No hay PDF disponible para este comprobante.</p>
                  )}
                  <button className="btn btn-secondary" onClick={() => handleCopy(d.id)} style={{ width: "100%" }}>
                    <Icons.Copy /> Copiar ID de comprobante
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-head"><h2 className="sec-title">Pago asociado</h2></div>
                <div className="card-body">
                  <Link href={`/admin/payments/${d.payment_id}`} className="row-link" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icons.Chevron />
                    <span className="mono">{d.payment_id.slice(0, 18)}…</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
