import type { Settlement } from '@/types/payments'

export interface Pagination {
  page: number
  limit: number
  total: number
  has_more: boolean
}

export interface SettlementsResponse {
  data: Settlement[]
  pagination: Pagination
}
