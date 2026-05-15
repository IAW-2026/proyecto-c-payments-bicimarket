import type { Settlement } from '@/types/payments'
import type { Payment, Refund, Payout } from '@/types/payments'

export interface Pagination {
  page: number
  limit: number
  total: number
  has_more: boolean
}

export interface ApiListResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface SettlementsResponse {
  data: Settlement[]
  pagination: Pagination
}

export interface PaymentsResponse extends ApiListResponse<Payment> {}

export interface RefundsResponse extends ApiListResponse<Refund> {}

export interface PayoutsResponse extends ApiListResponse<Payout> {}
