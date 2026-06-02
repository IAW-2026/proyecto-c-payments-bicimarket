"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import { AlertCircle, CheckCircle, ExternalLink, Loader2, ShoppingCart, XCircle, Clock, Bug } from "lucide-react"
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react'

/**
 * esta pagina simula el proceso de checkout en el frontend, creando una preferencia de pago y 
 * redirigiendo al usuario a Mercado Pago para completar la transacción.
 * El flujo es el siguiente:
 * 1. El usuario ingresa el monto a pagar y hace click en "Pay".
 * 2. Se crea una preferencia de pago en el backend, que devuelve una URL de checkout.
 * 3. El usuario es redirigido a Mercado Pago para completar el pago.
 * 4. Luego de completar el pago, Mercado Pago redirige al usuario de vuelta a esta página con el resultado.
 * 
 * en la implementación final esta página no va a existir, es solo a modo de demostración
 * y testing de mercadopago durante el desarrollo.
 */
export default function CheckoutPage() {
  const [amount, setAmount] = useState("500.00")
  const mpInitializedRef = useRef(false)

  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY

  useEffect(() => {
    if (!publicKey || mpInitializedRef.current) return
    initMercadoPago(publicKey)
    mpInitializedRef.current = true
  }, [publicKey])

  const mutation = useMutation<any, Error>({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(amount) * 100)
      const origin = window.location.origin
      const orderId = `order_${Date.now()}`
      const { data } = await axios.post('/api/test/checkout', {
        order_id: orderId,
        buyer_profile_id: "buyer_demo",
        buyer_clerk_user_id: "user_demo",
        buyer_email: "test_user_5539129628521320852@testuser.com",
        amount_cents: amountCents,
        currency: "ARS",
        return_urls: {
          success: `${origin}/admin/checkout?result=success&payment_id={payment_id}`,
          failure: `${origin}/admin/checkout?result=failure&payment_id={payment_id}`,
          pending: `${origin}/admin/checkout?result=pending&payment_id={payment_id}`,
        },
        items_summary: [
          {
            seller_profile_id: "seller_demo",
            subtotal_cents: amountCents,
            shipping_cost_cents: 0,
          },
        ],
      }, {
        headers: { 'Idempotency-Key': orderId },
      })
      return data
    },
  })

  const resp = mutation.data
  const checkoutUrl = resp?.data?.checkout_url
  const preferenceId = resp?.data?.preference_id

  const handleRedirect = useCallback(() => {
    if (checkoutUrl) window.location.href = checkoutUrl
  }, [checkoutUrl])

  const handleOpen = useCallback(() => {
    if (checkoutUrl) window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
  }, [checkoutUrl])

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: 480, maxWidth: "100%" }}>
        <div className="card-head">
          <ShoppingCart size={18} />
          <h2 className="sec-title">Checkout — Mercado Pago</h2>
        </div>

        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label className="l" htmlFor="amount">Amount (ARS)</label>
            <input id="amount" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>

          <button className="btn btn-primary btn-lg" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <><Loader2 className="animate-spin" size={16} /> Creating...</> : <><ShoppingCart size={16} /> Pay</>}
          </button>

          {mutation.isError && (
            <div className="alert error">
              <AlertCircle className="ic" size={16} /> <div className="a-body">{mutation.error?.message}</div>
            </div>
          )}

          {checkoutUrl && (
            <div className="alert success">
              <CheckCircle className="ic" size={16} />
              <div style={{ flex: 1 }}>
                <div className="a-title">Preference created</div>
                <div className="a-body">Preference ID: {preferenceId}</div>
                {preferenceId && publicKey && (
                  <div style={{ marginTop: 12 }}>
                    <Wallet initialization={{ preferenceId }} />
                  </div>
                )}
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <button onClick={handleRedirect} className="btn btn-primary btn-sm"><ExternalLink size={14} /> Go to Checkout</button>
                  <button onClick={handleOpen} className="btn btn-secondary btn-sm"><ExternalLink size={14} /> Open in new window</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card-foot" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--muted-foreground)" }}>
          <span>Use MERCADOPAGO_SANDBOX_MODE=true</span>
        </div>
      </div>
    </div>
  )
}
