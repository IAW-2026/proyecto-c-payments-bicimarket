export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'
export type SettlementStatus = 'pending' | 'paid' | 'failed' | 'manual_review'
export type PayoutStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'manual_review'
export type RefundStatus = 'pending' | 'approved' | 'failed'
export type RefundReason = 'seller_rejected' | 'buyer_cancelled' | 'not_delivered' | 'manual'
export type WebhookStatus = 'received' | 'processed' | 'failed'

export interface Payment {
  id: string
  order_id: string
  buyer_profile_id: string
  buyer_clerk_user_id?: string
  amount_cents: number
  currency: string
  status: PaymentStatus
  method?: string
  card_last4?: string
  gateway_reference?: string
  idempotency_key?: string
  approved_at?: Date
  rejected_at?: Date
  cancelled_at?: Date
  created_at: string
  updated_at: string
}

export interface Settlement {
  id: string
  payment_id: string
  order_id: string
  order_seller_group_id: string
  seller_profile_id: string
  gross_amount_cents: number
  fee_amount_cents: number
  net_amount_cents: number
  currency: string
  status: SettlementStatus
  paid_at?: Date
  payouts?: Payout[]
  created_at: string
  updated_at: string
}

export interface Payout {
  id: string
  settlement_id: string
  settlement?: Settlement
  transfer_id?: string
  status: PayoutStatus
  attempts: number
  last_error?: string
  started_at?: Date
  completed_at?: Date
  created_at: string
  updated_at: string
}

export interface Refund {
  id: string
  payment_id: string
  seller_profile_id?: string
  amount_cents: number
  reason: RefundReason
  status: RefundStatus
  gateway_reference?: string
  payment?: Pick<Payment, 'order_id'>
  created_at: string
  updated_at: string
}

export interface MpWebhookEvent {
  id: string
  mp_event_id: string
  event_type: string
  payload: any
  signature_valid: boolean
  processed_at?: Date
  last_error?: string
  status: WebhookStatus
  created_at: string
}

export interface PaymentCreateRequest {
  order_id: string
  buyer_profile_id: string
  buyer_clerk_user_id?: string
  buyer_email?: string
  amount_cents: number
  currency?: string
  idempotency_key?: string
  return_urls?: {
    success?: string
    failure?: string
    pending?: string
  }
  items_summary?: Array<{
    seller_profile_id: string
    subtotal_cents: number
    shipping_cost_cents: number
    order_seller_group_id?: string
    buyer_profile_id?: string
    buyer_clerk_user_id?: string
    items?: Array<{
      product_id: string
      product_name_snapshot: string
      unit_price_cents: number
      quantity: number
    }>
    shipping_address_snapshot?: Record<string, unknown>
    currency?: string
  }>
}

export interface PaymentResponse {
  data: Payment & { checkout_url?: string; gateway_reference?: string; preference_warning?: string | null }
}

export interface MercadoPagoPreference {
  id: string
  checkout_url: string
}
