"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import { AlertCircle, CheckCircle, ExternalLink, Loader2, ShoppingCart } from "lucide-react"
import type { PaymentResponse } from "@/types/payments"

export default function MockCheckoutPage() {
  const [email, setEmail] = useState("test_user_123@testuser.com")
  const [title, setTitle] = useState("Bicicleta Trek Marlin 5")
  const [amount, setAmount] = useState("500.00")

  const mutation = useMutation<PaymentResponse, Error>({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(amount) * 100)
      const { data } = await axios.post<PaymentResponse>("/api/v1/test/create-payment", {
        order_id: `mock_ord_${Date.now()}`,
        buyer_profile_id: "mock_buyer_test",
        buyer_clerk_user_id: "mock_user_test",
        buyer_email: email,
        amount_cents: amountCents,
        currency: "ARS",
        return_urls: {
          success: `${window.location.origin}/test/checkout?result=success`,
          failure: `${window.location.origin}/test/checkout?result=failure`,
          pending: `${window.location.origin}/test/checkout?result=pending`,
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

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: 480, maxWidth: "100%" }}>
        <div className="card-head">
          <ShoppingCart size={18} />
          <h2 className="sec-title">Mock Checkout — Mercado Pago</h2>
        </div>

        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

          {checkoutUrl && (
            <div className="alert success">
              <CheckCircle className="ic" size={16} />
              <div style={{ flex: 1 }}>
                <div className="a-title">Preferencia creada</div>
                <div className="a-body" style={{ marginTop: 4, wordBreak: "break-all" }}>
                  ID: {payment?.id}<br />
                  MP Ref: {payment?.gateway_reference}
                </div>
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 8, display: "inline-flex" }}
                >
                  <ExternalLink size={14} /> Abrir Checkout MP
                </a>
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
