"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import axios from "axios"
import { AlertCircle, Loader2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ARS } from "@/lib/currency"

const REFUND_REASONS = [
  { value: "seller_rejected", label: "Rechazado por vendedor" },
  { value: "buyer_cancelled", label: "Cancelado por comprador" },
  { value: "not_delivered", label: "No entregado" },
  { value: "manual", label: "Manual" },
] as const

interface RefundFormProps {
  paymentId: string
  amountCents: number
  currency?: string
  buyerProfileId?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
  trigger?: React.ReactNode
}

export function RefundForm({
  paymentId,
  amountCents,
  currency = "ARS",
  buyerProfileId,
  onSuccess,
  onError,
  trigger,
}: RefundFormProps) {
  const [open, setOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState(String(amountCents / 100))
  const [reason, setReason] = useState("manual")
  const [sellerProfileId, setSellerProfileId] = useState("")

  const refundMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`/api/v1/payments/${paymentId}/refund`, {
        amount_cents: Math.round(parseFloat(refundAmount) * 100),
        reason,
        seller_profile_id: sellerProfileId || undefined,
      })
      return data.data
    },
    onSuccess: () => {
      setOpen(false)
      onSuccess?.()
    },
    onError: (err: Error) => {
      onError?.(err)
    },
  })

  const refundCents = Math.round(parseFloat(refundAmount || "0") * 100)
  const isValid = refundCents > 0 && refundCents <= amountCents

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {trigger ?? <Button variant="destructive" size="sm"><Undo2 className="h-4 w-4 mr-1" /> Reembolsar</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Procesar Reembolso</DialogTitle>
          <DialogDescription>
            Reembolso para el pago {paymentId.slice(0, 14)}...
            {buyerProfileId && <span> · Comprador: {buyerProfileId.slice(0, 10)}...</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-amount">Monto a reembolsar ({currency})</Label>
            <Input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0.01"
              max={amountCents / 100}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Máximo: {ARS(amountCents)} · Monto ingresado: {ARS(refundCents)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Motivo</Label>
            <Select value={reason} onValueChange={(v) => v && setReason(v)}>
              <SelectTrigger id="refund-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seller-id">Seller Profile ID (opcional)</Label>
            <Input
              id="seller-id"
              placeholder="ID del vendedor"
              value={sellerProfileId}
              onChange={(e) => setSellerProfileId(e.target.value)}
            />
          </div>

          {!isValid && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                El monto debe ser mayor a 0 y menor o igual a {ARS(amountCents)}.
              </AlertDescription>
            </Alert>
          )}

          {refundMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {refundMutation.error?.message || "Error al procesar el reembolso"}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!isValid || refundMutation.isPending}
            onClick={() => refundMutation.mutate()}
          >
            {refundMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Procesando...</>
            ) : (
              <><Undo2 className="h-4 w-4 mr-1" /> Reembolsar {ARS(refundCents)}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
