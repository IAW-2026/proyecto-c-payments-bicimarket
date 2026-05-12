export interface PaymentFiltersProps {
  onFilterChange: (filters: Record<string, unknown>) => void
}

export interface RefundDialogProps {
  paymentId: string
  maxAmount: number
  trigger?: React.ReactNode
}

export interface SettlementTableProps {
  settlements: Array<{
    id: string
    seller_profile_id: string
    order_id: string
    gross_amount_cents: number
    fee_amount_cents: number
    net_amount_cents: number
    status: string
    created_at: string
    payouts?: unknown[]
  }>
  isLoading?: boolean
}
