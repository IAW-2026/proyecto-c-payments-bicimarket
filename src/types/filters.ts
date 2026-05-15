export interface PaymentFilters {
  orderId?: string
  buyerId?: string
  status?: string | null
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface SettlementFilters {
  paymentId?: string
  sellerId?: string
  status?: string | null
  from?: string
  to?: string
  page?: number
  limit?: number
}

export interface PayoutFilters {
  settlementId?: string
  status?: string
  page?: number
  limit?: number
}
