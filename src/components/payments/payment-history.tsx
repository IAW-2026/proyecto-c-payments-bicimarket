"use client"

import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface PaymentAttemptItem {
  id: string
  attempt_number: number
  provider: string
  status: string
  error_code?: string | null
  error_message?: string | null
  created_at: string
}

export interface PaymentHistoryProps {
  attempts: PaymentAttemptItem[]
  isLoading?: boolean
}

const attemptStatusIcon = (status: string) => {
  switch (status) {
    case "approved": return <CheckCircle className="h-4 w-4 text-green-500" />
    case "rejected":
    case "cancelled": return <XCircle className="h-4 w-4 text-red-500" />
    case "pending": return <Clock className="h-4 w-4 text-amber-500" />
    default: return <Loader2 className="h-4 w-4 animate-spin" />
  }
}

export function PaymentHistory({ attempts, isLoading }: PaymentHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Historial de Intentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (attempts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Historial de Intentos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sin intentos registrados.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Historial de Intentos ({attempts.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-64">
          <div className="space-y-3">
            {attempts.map((attempt, idx) => (
              <div key={attempt.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                <div className="mt-0.5">
                  {attemptStatusIcon(attempt.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Intento #{attempt.attempt_number}
                    </span>
                    <Badge variant={
                      attempt.status === "rejected" || attempt.status === "cancelled" ? "destructive" :
                      attempt.status === "approved" ? "default" :
                      "secondary"
                    } className="text-[10px] px-1.5 py-0">
                      {attempt.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {attempt.provider} · {new Date(attempt.created_at).toLocaleString("es-AR")}
                  </p>
                  {attempt.error_message && (
                    <p className="text-xs text-red-500 mt-0.5 truncate" title={attempt.error_message}>
                      {attempt.error_message}
                    </p>
                  )}
                  {attempt.error_code && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Código: {attempt.error_code}
                    </p>
                  )}
                </div>
                {idx === 0 && (
                  <Badge variant="outline" className="text-[10px]">Último</Badge>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
