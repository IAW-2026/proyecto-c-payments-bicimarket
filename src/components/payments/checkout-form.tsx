"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import { AlertCircle, CheckCircle, ExternalLink, Loader2, ShoppingCart, Bug, Clock, XCircle } from "lucide-react"
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { PaymentCreateRequest } from "@/types/payments"

export interface CheckoutFormItem {
  productName: string
  unitPriceCents: number
  quantity: number
  productId?: string
}

export interface CheckoutFormSellerGroup {
  sellerProfileId: string
  items: CheckoutFormItem[]
  shippingCostCents?: number
  orderSellerGroupId?: string
}

export interface CheckoutFormProps {
  amountCents: number
  currency?: string
  orderId?: string
  buyerProfileId?: string
  buyerClerkUserId?: string
  buyerEmail?: string
  sellerGroups?: CheckoutFormSellerGroup[]
  returnUrls?: {
    success?: string
    failure?: string
    pending?: string
  }
  onPreferenceCreated?: (data: { paymentId: string; preferenceId: string; checkoutUrl: string }) => void
  onError?: (error: Error) => void
  children?: React.ReactNode
}

export function CheckoutForm({
  amountCents,
  currency = "ARS",
  orderId: fixedOrderId,
  buyerProfileId: fixedBuyerProfileId,
  buyerClerkUserId: fixedBuyerClerkUserId,
  buyerEmail: fixedBuyerEmail,
  sellerGroups,
  returnUrls,
  onPreferenceCreated,
  onError,
  children,
}: CheckoutFormProps) {
  const [email, setEmail] = useState(fixedBuyerEmail ?? "")
  const mpInitializedRef = useRef(false)

  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY

  useEffect(() => {
    if (!publicKey || mpInitializedRef.current) return
    initMercadoPago(publicKey)
    mpInitializedRef.current = true
  }, [publicKey])

  const mutation = useMutation({
    mutationFn: async () => {
      const origin = window.location.origin
      const payload: PaymentCreateRequest = {
        order_id: fixedOrderId ?? `order_${Date.now()}`,
        buyer_profile_id: fixedBuyerProfileId ?? "buyer_demo",
        buyer_clerk_user_id: fixedBuyerClerkUserId,
        buyer_email: email || undefined,
        amount_cents: amountCents,
        currency,
        return_urls: returnUrls ?? {
          success: `${origin}/admin/checkout?result=success&payment_id={payment_id}`,
          failure: `${origin}/admin/checkout?result=failure&payment_id={payment_id}`,
          pending: `${origin}/admin/checkout?result=pending&payment_id={payment_id}`,
        },
        items_summary: sellerGroups?.map((g) => ({
          seller_profile_id: g.sellerProfileId,
          subtotal_cents: g.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0),
          shipping_cost_cents: g.shippingCostCents ?? 0,
          order_seller_group_id: g.orderSellerGroupId,
          items: g.items.map((item) => ({
            product_id: item.productId ?? "unknown",
            product_name_snapshot: item.productName,
            unit_price_cents: item.unitPriceCents,
            quantity: item.quantity,
          })),
        })),
      }
      const { data } = await axios.post("/api/v1/payments", payload)
      return data
    },
    onSuccess: (data) => {
      if (data?.data) {
        onPreferenceCreated?.({
          paymentId: data.data.payment_id,
          preferenceId: data.data.preference_id,
          checkoutUrl: data.data.checkout_url,
        })
      }
    },
    onError: (err: Error) => {
      onError?.(err)
    },
  })

  const resp = mutation.data
  const checkoutUrl = resp?.data?.checkout_url
  const preferenceId = resp?.data?.preference_id
  const warning = resp?.data?.preference_warning
  const canRenderWallet = Boolean(publicKey && preferenceId)

  const handleRedirect = useCallback(() => {
    if (checkoutUrl) window.location.href = checkoutUrl
  }, [checkoutUrl])

  const handleOpen = useCallback(() => {
    if (checkoutUrl) window.open(checkoutUrl, "_blank", "noopener,noreferrer")
  }, [checkoutUrl])

  const itemCount = sellerGroups?.reduce((sum, g) => sum + g.items.reduce((s, i) => s + i.quantity, 0), 0) ?? 0

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Checkout - Mercado Pago
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!fixedBuyerEmail && (
          <div className="space-y-2">
            <Label htmlFor="checkout-email">Email del comprador</Label>
            <Input
              id="checkout-email"
              type="email"
              placeholder="test_user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}

        {children}

        {sellerGroups && sellerGroups.length > 0 && (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Resumen del pedido ({itemCount} items)
            </p>
            {sellerGroups.map((group, gi) => (
              <div key={gi}>
                {gi > 0 && <Separator className="my-2" />}
                <p className="text-xs text-muted-foreground">
                  Vendedor: {group.sellerProfileId.slice(0, 10)}...
                </p>
                {group.items.map((item, ii) => (
                  <div key={ii} className="flex justify-between text-sm ml-2">
                    <span>{item.productName} x{item.quantity}</span>
                    <span className="tabular-nums">
                      {(item.unitPriceCents * item.quantity / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
                {group.shippingCostCents ? (
                  <div className="flex justify-between text-sm text-muted-foreground ml-2">
                    <span>Envío</span>
                    <span>{(group.shippingCostCents / 100).toFixed(2)}</span>
                  </div>
                ) : null}
              </div>
            ))}
            <Separator className="my-1" />
            <div className="flex justify-between text-sm font-medium">
              <span>Total</span>
              <span className="tabular-nums">{(amountCents / 100).toFixed(2)} {currency}</span>
            </div>
          </div>
        )}

        {mutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {mutation.error?.message || "No se pudo crear la preferencia de pago"}
            </AlertDescription>
          </Alert>
        )}

        {warning && (
          <Alert variant="destructive">
            <Bug className="h-4 w-4" />
            <AlertTitle>Advertencia de preferencia</AlertTitle>
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}

        {!publicKey && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Falta Public Key</AlertTitle>
            <AlertDescription>
              Definí <strong>NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY</strong> para inicializar el SDK.
            </AlertDescription>
          </Alert>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creando preferencia...</>
          ) : (
            <><ShoppingCart className="h-4 w-4 mr-2" /> Pagar {(amountCents / 100).toFixed(2)} {currency}</>
          )}
        </Button>

        {checkoutUrl && (
          <Alert variant="default">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle>Preferencia creada</AlertTitle>
            <AlertDescription>
              <div className="mt-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Preference ID: {preferenceId}
                </p>
                {canRenderWallet && preferenceId && (
                  <div className="wallet-container" style={{ minHeight: 48 }}>
                    <Wallet initialization={{ preferenceId }} />
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleRedirect}>
                    <ExternalLink className="h-3 w-3 mr-1" /> Ir al Checkout
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleOpen}>
                    <ExternalLink className="h-3 w-3 mr-1" /> Abrir en nueva ventana
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-between text-xs text-muted-foreground">
        <span>{itemCount} items</span>
        <Badge variant="outline" className="text-[10px]">
          {currency}
        </Badge>
      </CardFooter>
    </Card>
  )
}
