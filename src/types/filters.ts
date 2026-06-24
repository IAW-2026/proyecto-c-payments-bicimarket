export interface PaymentFilters {
  orderId?: string
  buyerId?: string
  status?: string | null
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

export interface SettlementFilters {
  paymentId?: string
  sellerId?: string
  status?: string | null
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}

export interface PayoutFilters {
  settlementId?: string
  status?: string
  q?: string
  page?: number
  limit?: number
}
