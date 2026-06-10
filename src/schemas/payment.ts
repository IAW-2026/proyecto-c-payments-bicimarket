import { z } from 'zod'

export const itemsSummarySchema = z.object({
  seller_profile_id: z.string().min(1, 'seller_profile_id is required'),
  subtotal_cents: z.number().int().min(0),
  shipping_cost_cents: z.number().int().min(0),
  order_seller_group_id: z.string().optional(),
  buyer_profile_id: z.string().optional(),
  buyer_clerk_user_id: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string(),
    product_name_snapshot: z.string(),
    unit_price_cents: z.number().int(),
    quantity: z.number().int().min(1),
  })).optional(),
  shipping_address_snapshot: z.any().optional(),
  currency: z.string().optional(),
})

export const createPaymentSchema = z.object({
  order_id: z.string().min(1, 'order_id is required'),
  buyer_profile_id: z.string().min(1, 'buyer_profile_id is required'),
  buyer_clerk_user_id: z.string(),
  buyer_email: z.string().email().optional(),
  amount_cents: z.number().int().positive('amount_cents must be positive'),
  currency: z.string().default('ARS'),
  items_summary: z.array(itemsSummarySchema).optional(),
  return_urls: z.object({
    success: z.string().url().optional(),
    failure: z.string().url().optional(),
    pending: z.string().url().optional(),
  }).optional(),
})

export const createRefundSchema = z.object({
  amount_cents: z.number().int().positive('amount_cents must be positive'),
  reason: z.enum(['seller_rejected', 'buyer_cancelled', 'not_delivered', 'manual'] as const).default('seller_rejected'),
  seller_profile_id: z.string().optional(),
})

export const confirmPaymentSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  gateway_reference: z.string().optional(),
  reason: z.string().optional(),
})

export const createSettlementSchema = z.object({
  order_id: z.string().min(1),
  order_seller_group_id: z.string().min(1),
  seller_profile_id: z.string().min(1),
  payment_id: z.string().min(1),
  gross_amount_cents: z.number().int().min(0),
  fee_amount_cents: z.number().int().min(0),
  net_amount_cents: z.number().int().min(0),
  currency: z.string().default('ARS'),
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type CreateRefundInput = z.infer<typeof createRefundSchema>
export type CreateSettlementInput = z.infer<typeof createSettlementSchema>
