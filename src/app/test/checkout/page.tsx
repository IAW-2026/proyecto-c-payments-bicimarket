"use client"

import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import { AlertCircle, CheckCircle, ExternalLink, Loader2, ShoppingCart, XCircle, Clock, Bug } from "lucide-react"
import type { PaymentResponse } from "@/types/payments"

function useQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get(name)
}

export default function MockCheckoutPage() {
  const [email, setEmail] = useState("test_user_123@testuser.com")
  const [title, setTitle] = useState("Bicicleta Trek Marlin 5")
  const [amount, setAmount] = useState("500.00")

  const result = useQueryParam('result')
  const paymentId = useQueryParam('payment_id')
  const collectionId = useQueryParam('collection_id')
  const preferenceWarning = useQueryParam('preference_warning')

  const mutation = useMutation<PaymentResponse, Error>({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(amount) * 100)
      const origin = window.location.origin
      const { data } = await axios.post<PaymentResponse>("/api/v1/test/create-payment", {
        order_id: `mock_ord_${Date.now()}`,
        buyer_profile_id: "mock_buyer_test",
        buyer_clerk_user_id: "mock_user_test",
        buyer_email: email,
        amount_cents: amountCents,
        currency: "ARS",
        return_urls: {
          success: `${origin}/test/checkout?result=success&payment_id={payment_id}`,
          failure: `${origin}/test/checkout?result=failure&payment_id={payment_id}`,
          pending: `${origin}/test/checkout?result=pending&payment_id={payment_id}`,
        },
        items_summary: [
          {
            seller_profile_id: "mock_seller_test",
            subtotal_cents: amountCents,
            shipping_cost_cents: 0,
          },
        ],
      })
      return data
    },
  })

  const payment = mutation.data?.data
  const checkoutUrl = payment?.checkout_url
  const warning = payment?.preference_warning || preferenceWarning

  // Use window.location.href for same-window redirect to maintain cookies
  const handleRedirectCheckout = useCallback(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl
    }
  }, [checkoutUrl])

  // Fallback: open in new window (may lose cookies in some browsers)
  const handleOpenCheckout = useCallback(() => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
    }
  }, [checkoutUrl])

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: 480, maxWidth: "100%" }}>
        <div className="card-head">
          <ShoppingCart size={18} />
          <h2 className="sec-title">Mock Checkout — Mercado Pago</h2>
        </div>

        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {result && (
            <div className={`alert ${result === 'success' ? 'success' : result === 'failure' ? 'error' : 'info'}`}>
              {result === 'success' ? <CheckCircle className="ic" size={16} /> :
               result === 'failure' ? <XCircle className="ic" size={16} /> :
               <Clock className="ic" size={16} />}
              <div>
                <div className="a-title">
                  Pago {result === 'success' ? 'Aprobado' : result === 'failure' ? 'Rechazado' : 'Pendiente'}
                </div>
                <div className="a-body">
                  {collectionId && <>Collection ID: {collectionId}<br /></>}
                  {paymentId && <>Payment ID: {paymentId}</>}
                  {!collectionId && !paymentId && 'El pago fue procesado. Verificá el estado en el panel de administración.'}
                </div>
              </div>
            </div>
          )}

          <div className="alert info">
            <AlertCircle className="ic" size={16} />
            <div>
              <div className="a-title">Sandbox Testing</div>
              <div className="a-body">
                Usá la tarjeta <strong>4111 1111 1111 1111</strong> (CVV: 123, venc: 12/30) para pagos aprobados, o{" "}
                <strong>4000 0000 0000 0002</strong> para rechazados.
              </div>
            </div>
          </div>

          <div className="field">
            <label className="l" htmlFor="email">Comprador Email</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder="test@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="l" htmlFor="title">Producto</label>
            <input
              id="title"
              className="input"
              placeholder="Bicicleta Trek Marlin 5"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="l" htmlFor="amount">Monto (ARS)</label>
            <input
              id="amount"
              className="input"
              type="number"
              step="0.01"
              min="1"
              placeholder="500.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ justifyContent: "center", marginTop: 4 }}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Creando preferencia...</>
            ) : (
              <><ShoppingCart size={16} /> Iniciar Pago</>
            )}
          </button>

          {mutation.isError && (
            <div className="alert error">
              <AlertCircle className="ic" size={16} />
              <div>
                <div className="a-title">Error</div>
                <div className="a-body">{mutation.error?.message || "No se pudo crear el pago"}</div>
              </div>
            </div>
          )}

          {warning && (
            <div className="alert error">
              <Bug className="ic" size={16} />
              <div>
                <div className="a-title">Advertencia de preferencia</div>
                <div className="a-body">{warning}</div>
              </div>
            </div>
          )}

          {checkoutUrl && (
            <div className="alert success">
              <CheckCircle className="ic" size={16} />
              <div style={{ flex: 1 }}>
                <div className="a-title">Preferencia creada</div>
                <div className="a-body" style={{ marginTop: 4, wordBreak: "break-all" }}>
                  ID: {payment?.id}<br />
                  MP Ref: {payment?.gateway_reference}<br />
                  <span className="muted" style={{ fontSize: 11 }}>
                    Sandbox: {checkoutUrl.includes('sandbox') ? '✅' : '❌'}
                  </span>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button
                    onClick={handleRedirectCheckout}
                    className="btn btn-primary btn-sm"
                  >
                    <ExternalLink size={14} /> Ir al Checkout (misma ventana)
                  </button>
                  <button
                    onClick={handleOpenCheckout}
                    className="btn btn-secondary btn-sm"
                  >
                    <ExternalLink size={14} /> Abrir en nueva ventana
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card-foot" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--muted-foreground)" }}>
          <span>Usa <code className="kbd">MERCADOPAGO_SANDBOX_MODE=true</code></span>
          <a href="/admin" style={{ color: "var(--primary)" }}>Ir al Admin</a>
        </div>
      </div>
    </div>
  )
}
