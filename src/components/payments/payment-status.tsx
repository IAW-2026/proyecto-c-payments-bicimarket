"use client"

import { AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

export type PaymentResultStatus = "success" | "failure" | "pending" | "refunded" | "cancelled"

export interface PaymentResultDisplay {
  status: PaymentResultStatus
  title?: string
  description?: string
  paymentId?: string | null
  collectionId?: string | null
  gatewayReference?: string | null
  amountCents?: number | null
}

const statusConfig: Record<PaymentResultStatus, {
  variant: "default" | "destructive"
  icon: typeof CheckCircle
  defaultTitle: string
}> = {
  success: { variant: "default", icon: CheckCircle, defaultTitle: "Pago Aprobado" },
  failure: { variant: "destructive", icon: XCircle, defaultTitle: "Pago Rechazado" },
  pending: { variant: "default", icon: Clock, defaultTitle: "Pago Pendiente" },
  refunded: { variant: "default", icon: AlertCircle, defaultTitle: "Pago Reembolsado" },
  cancelled: { variant: "default", icon: XCircle, defaultTitle: "Pago Cancelado" },
}

export function PaymentStatus({
  status,
  title,
  description,
  paymentId,
  collectionId,
  gatewayReference,
  amountCents,
}: PaymentResultDisplay) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Alert variant={config.variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title ?? config.defaultTitle}</AlertTitle>
      <AlertDescription>
        {description ?? (
          <div className="flex flex-col gap-1 text-sm">
            {amountCents !== null && amountCents !== undefined && (
              <span>Monto: {(amountCents / 100).toFixed(2)}</span>
            )}
            {paymentId && <span>Payment ID: {paymentId}</span>}
            {collectionId && <span>Collection ID: {collectionId}</span>}
            {gatewayReference && <span>Gateway ref: {gatewayReference}</span>}
          </div>
        )}
        <div className="mt-2">
        <Badge variant={status === "failure" ? "destructive" : "secondary"}>
          {status}
        </Badge>
        </div>
      </AlertDescription>
    </Alert>
  )
}
