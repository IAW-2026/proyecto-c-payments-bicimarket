// Payments App — BiciMarket
// Usage: npx tsx seeds/seed-payments.ts
// Adjust the import path to match your Prisma client output location.
// For this app: import { PrismaClient, ... } from '../src/generated/prisma/client';

import { Prisma } from '../src/generated/prisma/client'
import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────────────────────
const START = new Date('2026-04-01T00:00:00Z')
const END = new Date('2026-06-24T23:59:59Z')

function daysBefore(days: number): Date {
  const d = new Date(END)
  d.setDate(d.getDate() - days)
  d.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60))
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function pad(n: number): string {
  return String(n).padStart(3, '0')
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── Shared Reference Data ───────────────────────────────────────────────────

const BUYERS = Array.from({ length: 25 }, (_, i) => ({
  id: `byp_buyer_${pad(i + 1)}`,
  clerk: `user_buyer_${pad(i + 1)}`,
}))

const AMOUNTS = [5000000, 15000000, 30000000, 50000000, 75000000, 100000000, 150000000, 200000000, 250000000, 350000000]
const METHODS = ['credit_card', 'debit_card', 'account_money', 'bank_transfer'] as const

type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'
type SettlementStatus = 'pending' | 'paid' | 'failed' | 'manual_review'
type PayoutStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'manual_review'
type RefundStatus = 'pending' | 'approved' | 'failed'
type RefundReason = 'seller_rejected' | 'buyer_cancelled' | 'not_delivered' | 'manual'

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding Payments App...\n')

  // Clean existing data
  console.log('Cleaning existing data...')
  const cleanOrder = [
    'outboundCallLog', 'webhookJob', 'mpWebhookEvent',
    'refundStatusHistory', 'refund',
    'payout', 'settlementStatusHistory', 'settlement',
    'receipt', 'paymentAttempt', 'paymentStatusHistory', 'payment',
  ] as const
  const modelMap: Record<string, any> = {
    outboundCallLog: prisma.outboundCallLog,
    webhookJob: prisma.webhookJob,
    mpWebhookEvent: prisma.mpWebhookEvent,
    refundStatusHistory: prisma.refundStatusHistory,
    refund: prisma.refund,
    payout: prisma.payout,
    settlementStatusHistory: prisma.settlementStatusHistory,
    settlement: prisma.settlement,
    receipt: prisma.receipt,
    paymentAttempt: prisma.paymentAttempt,
    paymentStatusHistory: prisma.paymentStatusHistory,
    payment: prisma.payment,
  }
  for (const m of cleanOrder) {
    await (modelMap[m] as any).deleteMany()
  }
  console.log('  Clean done.\n')

  let paymentCount = 0
  let receiptCount = 0
  let settlementCount = 0
  let payoutCount = 0
  let refundCount = 0
  let webhookCount = 0
  let webhookJobCount = 0
  let totalAmountCents = 0

  const TOTAL = 40

  // Status distribution: 25 approved, 5 pending, 3 rejected, 3 cancelled, 4 refunded
  const statuses: PaymentStatus[] = [
    ...Array(25).fill('approved'),
    ...Array(5).fill('pending'),
    ...Array(3).fill('rejected'),
    ...Array(3).fill('cancelled'),
    ...Array(4).fill('refunded'),
  ]

  for (let i = 0; i < TOTAL; i++) {
    const idx = pad(i + 1)
    const buyer = BUYERS[i % BUYERS.length]
    const sellerId = `slp_seller_${pad((i % 10) + 1)}`
    const amount = AMOUNTS[i % AMOUNTS.length]
    const method = pick(METHODS)
    const currency = 'ARS'

    const status = statuses[i]
    const isFinal = status === 'approved' || status === 'refunded'

    // Multi-seller every 5th payment (orders 5, 10, 15, ...)
    const isMultiSeller = isFinal && (i + 1) % 5 === 0 && i > 0
    const secondSellerId = isMultiSeller ? `slp_seller_${pad(((i + 3) % 10) + 1)}` : null

    // Time distribution: older payments get more days back
    const daysBack = 85 - i * 2
    const createdDate = daysBefore(daysBack)
    const approvedDate = addDays(createdDate, 1)
    const deliveredDate = addDays(createdDate, 5)

    const idempotencyKey = `ik_seed_${idx}`
    const preferenceId = String(2000000 + i)
    const checkoutUrl = `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`

    const orderId = `ord_buyer_${idx}`
    const osgId = `osg_${orderId}_${sellerId}`
    const salesOrderId = `sor_${sellerId}_${idx}`

    // Multi-seller groups
    const osg2Id = secondSellerId ? `osg_${orderId}_${secondSellerId}` : null
    const so2Id = secondSellerId ? `sor_${secondSellerId}_${idx}` : null

    const fee = Math.round(amount * 0.1)
    const net = amount - fee

    // ── Payment ──
    const payment = await prisma.payment.create({
      data: {
        id: `pay_payment_${idx}`,
        order_id: orderId,
        buyer_profile_id: buyer.id,
        buyer_clerk_user_id: buyer.clerk,
        amount_cents: amount,
        currency,
        status,
        ...(isFinal ? { method } : {}),
        ...(isFinal ? { card_last4: String(4000 + i).slice(-4) } : {}),
        ...(isFinal ? { gateway_reference: `mp_payment_${2000000 + i}` } : {}),
        idempotency_key: idempotencyKey,
        checkout_url: isFinal ? checkoutUrl : null,
        preference_id: isFinal ? preferenceId : null,
        ...(status === 'approved' || status === 'refunded' ? { approved_at: approvedDate } : {}),
        ...(status === 'rejected' ? { rejected_at: createdDate } : {}),
        ...(status === 'cancelled' ? { cancelled_at: createdDate } : {}),
        ...(isFinal ? {
          items_summary: [
            {
              seller_profile_id: sellerId,
              subtotal_cents: Math.round(amount * 0.85),
              shipping_cost_cents: Math.round(amount * 0.15),
              order_seller_group_id: osgId,
              items: [{ product_id: `prd_${sellerId}_1`, product_name_snapshot: 'Producto', unit_price_cents: Math.round(amount * 0.85), quantity: 1 }],
            },
            ...(secondSellerId ? [{
              seller_profile_id: secondSellerId,
              subtotal_cents: Math.round(amount * 0.45),
              shipping_cost_cents: Math.round(amount * 0.05),
              order_seller_group_id: osg2Id,
              items: [{ product_id: `prd_${secondSellerId}_1`, product_name_snapshot: 'Producto 2', unit_price_cents: Math.round(amount * 0.45), quantity: 1 }],
            }] : []),
          ],
        } : {}),
        created_at: createdDate,
      },
    })
    totalAmountCents += amount
    paymentCount++

    // ── PaymentStatusHistory ──
    const statusHistoryEntries: Array<{ from: PaymentStatus | null; to: PaymentStatus; reason: string }> = []

    if (status === 'pending') {
      statusHistoryEntries.push({ from: null, to: 'pending', reason: 'payment_created' })
    } else if (status === 'approved') {
      statusHistoryEntries.push({ from: null, to: 'pending', reason: 'payment_created' })
      statusHistoryEntries.push({ from: 'pending', to: 'approved', reason: 'payment_approved_via_mp_webhook' })
    } else if (status === 'rejected') {
      statusHistoryEntries.push({ from: null, to: 'pending', reason: 'payment_created' })
      statusHistoryEntries.push({ from: 'pending', to: 'rejected', reason: 'payment_rejected_by_mp_gateway' })
    } else if (status === 'cancelled') {
      statusHistoryEntries.push({ from: null, to: 'pending', reason: 'payment_created' })
      statusHistoryEntries.push({ from: 'pending', to: 'cancelled', reason: 'buyer_cancelled_checkout' })
    } else if (status === 'refunded') {
      statusHistoryEntries.push({ from: null, to: 'pending', reason: 'payment_created' })
      statusHistoryEntries.push({ from: 'pending', to: 'approved', reason: 'payment_approved_via_mp_webhook' })
      statusHistoryEntries.push({ from: 'approved', to: 'refunded', reason: 'full_refund_processed' })
    }

    for (const entry of statusHistoryEntries) {
      await prisma.paymentStatusHistory.create({
        data: {
          payment_id: payment.id,
          from_status: entry.from,
          to_status: entry.to,
          changed_by: 'system',
          reason: entry.reason,
          created_at: entry.from ? addDays(createdDate, 1) : createdDate,
        },
      })
    }

    // ── PaymentAttempt (for finalized payments) ──
    if (status === 'approved') {
      await prisma.paymentAttempt.create({
        data: {
          payment_id: payment.id,
          attempt_number: 1,
          provider: 'mercadopago',
          status: 'approved',
          request_payload: {
            items: [{ title: `Order ${idx}`, quantity: 1, unit_price: amount / 100 }],
            external_reference: payment.id,
          },
          response_payload: { id: preferenceId, init_point: checkoutUrl, status: 'approved', status_detail: 'accredited' },
          created_at: createdDate,
        },
      })
    } else if (status === 'rejected') {
      const errors = [
        { code: 'cc_rejected_card_disabled', message: 'La tarjeta se encuentra deshabilitada' },
        { code: 'cc_rejected_insufficient_amount', message: 'Fondos insuficientes' },
        { code: 'cc_rejected_other_reason', message: 'La tarjeta fue rechazada' },
        { code: 'cc_rejected_blacklist', message: 'La tarjeta no puede procesarse' },
      ]
      const err = errors[i % errors.length]
      await prisma.paymentAttempt.create({
        data: {
          payment_id: payment.id,
          attempt_number: 1,
          provider: 'mercadopago',
          status: 'rejected',
          error_code: err.code,
          error_message: err.message,
          request_payload: { items: [{ title: `Order ${idx}`, quantity: 1, unit_price: amount / 100 }] },
          response_payload: { status: 'rejected', status_detail: err.code },
          created_at: createdDate,
        },
      })
    }

    // ── Receipt (for approved / refunded) ──
    if (isFinal) {
      await prisma.receipt.create({
        data: {
          payment_id: payment.id,
          receipt_number: `RCP-${String(10000 + i).slice(1)}`,
          receipt_url: `https://api.mercadopago.com/v1/payments/${2000000 + i}/receipt`,
          amount_cents: amount,
          idempotency_key: `ik_receipt_${idx}`,
          issued_at: approvedDate,
          created_at: approvedDate,
        },
      })
      receiptCount++
    }

    // ── Settlements (for approved / refunded) ──
    if (isFinal) {
      let sStatus: SettlementStatus
      if (status === 'refunded') {
        sStatus = 'paid'
      } else {
        const roll = i % 10
        if (roll < 5) sStatus = 'paid'
        else if (roll < 7) sStatus = 'pending'
        else if (roll < 8) sStatus = 'failed'
        else sStatus = 'manual_review'
      }

      const settlement = await prisma.settlement.create({
        data: {
          payment_id: payment.id,
          order_id: orderId,
          order_seller_group_id: osgId,
          sales_order_id: salesOrderId,
          seller_profile_id: sellerId,
          shipment_id: `shp_${orderId}_${sellerId}`,
          delivered_at: deliveredDate,
          gross_amount_cents: amount,
          fee_amount_cents: fee,
          net_amount_cents: net,
          currency,
          status: sStatus,
          ...(sStatus === 'paid' ? { paid_at: addDays(deliveredDate, 2) } : {}),
          created_at: deliveredDate,
        },
      })
      settlementCount++

      // SettlementStatusHistory
      const sFrom: SettlementStatus | null = sStatus === 'pending' ? null : 'pending'
      const sReason = sStatus === 'paid' ? 'settlement_paid_via_payout'
        : sStatus === 'pending' ? 'settlement_created_after_delivery'
        : sStatus === 'failed' ? 'settlement_payout_failed'
        : 'settlement_marked_manual_review_by_admin'

      await prisma.settlementStatusHistory.create({
        data: {
          settlement_id: settlement.id,
          from_status: sFrom,
          to_status: sStatus,
          changed_by: 'system',
          reason: sReason,
          created_at: sFrom ? addDays(deliveredDate, 1) : deliveredDate,
        },
      })

      // ── Payout (for paid settlements) ──
      if (sStatus === 'paid') {
        const pStatus: PayoutStatus = i % 7 === 0 ? 'failed' : i % 7 === 1 ? 'pending' : 'completed'
        await prisma.payout.create({
          data: {
            settlement_id: settlement.id,
            transfer_id: pStatus === 'completed' ? `trf_${4000000 + i}` : null,
            status: pStatus,
            attempts: pStatus === 'completed' ? 1 : pStatus === 'failed' ? 3 : 0,
            last_error: pStatus === 'failed' ? 'Transfer rejected by MP: invalid collector_id' : null,
            idempotency_key: `ik_payout_${idx}`,
            ...(pStatus === 'completed' || pStatus === 'failed' ? { started_at: addDays(deliveredDate, 1) } : {}),
            ...(pStatus === 'completed' ? { completed_at: addDays(deliveredDate, 2) } : {}),
            created_at: deliveredDate,
          },
        })
        payoutCount++
      }

      // ── Second seller settlement (multi-seller) ──
      if (secondSellerId && osg2Id) {
        const s2Amount = Math.round(amount * 0.45)
        const s2Fee = Math.round(s2Amount * 0.1)
        const s2Net = s2Amount - s2Fee

        const s2 = await prisma.settlement.create({
          data: {
            payment_id: payment.id,
            order_id: orderId,
            order_seller_group_id: osg2Id,
            sales_order_id: so2Id!,
            seller_profile_id: secondSellerId,
            shipment_id: `shp_${orderId}_${secondSellerId}`,
            delivered_at: deliveredDate,
            gross_amount_cents: s2Amount,
            fee_amount_cents: s2Fee,
            net_amount_cents: s2Net,
            currency,
            status: 'pending',
            created_at: deliveredDate,
          },
        })
        settlementCount++

        await prisma.settlementStatusHistory.create({
          data: {
            settlement_id: s2.id,
            from_status: null,
            to_status: 'pending',
            changed_by: 'system',
            reason: 'settlement_created_after_delivery_multi_seller',
            created_at: deliveredDate,
          },
        })
      }

      // ── Refund (for refunded payments + some random approved) ──
      if (status === 'refunded' || (status === 'approved' && i % 4 === 3 && i < 30)) {
        const isFull = status === 'refunded'
        const refAmount = isFull ? amount : Math.round(amount * 0.3)
        const refStatusRoll = i % 10
        const refStatus: RefundStatus = refStatusRoll === 0 ? 'failed' : refStatusRoll === 1 ? 'pending' : 'approved'
        const reasons: RefundReason[] = ['seller_rejected', 'buyer_cancelled', 'not_delivered', 'manual']
        const reason: RefundReason = isFull ? 'seller_rejected' : reasons[i % reasons.length]

        const refund = await prisma.refund.create({
          data: {
            payment_id: payment.id,
            seller_profile_id: isFull ? sellerId : undefined,
            amount_cents: refAmount,
            currency,
            reason,
            status: refStatus,
            gateway_reference: refStatus !== 'pending' ? `mp_refund_${3000000 + i}` : null,
            idempotency_key: `ik_refund_${idx}`,
            created_at: addDays(approvedDate, isFull ? 7 : 2),
          },
        })
        refundCount++

        // RefundStatusHistory
        const rFrom: RefundStatus | null = refStatus === 'pending' ? null : 'pending'
        await prisma.refundStatusHistory.create({
          data: {
            refund_id: refund.id,
            from_status: rFrom,
            to_status: refStatus,
            changed_by: 'system',
            reason: refStatus === 'approved' ? 'refund_processed_by_mp' : refStatus === 'failed' ? 'refund_failed_mp_error' : 'refund_requested',
            created_at: rFrom ? addDays(approvedDate, isFull ? 8 : 3) : addDays(approvedDate, isFull ? 7 : 2),
          },
        })
      }
    }

    // ── MpWebhookEvent ──
    if (status === 'approved' || status === 'rejected' || status === 'refunded') {
      const eventType = status === 'approved' ? 'payment.approved'
        : status === 'rejected' ? 'payment.rejected'
        : 'payment.refunded'
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: `mp_evt_seed_${idx}`,
          event_type: eventType,
          payload: {
            action: eventType,
            data: { id: String(2000000 + i) },
            live_mode: false,
            user_id: 44444,
            api_version: 'v1',
          },
          signature_valid: true,
          status: 'processed',
          processed_at: addDays(createdDate, 1),
          created_at: createdDate,
        },
      })
      webhookCount++

      // ── WebhookJob (process_webhook + send_notification) ──
      await prisma.webhookJob.create({
        data: {
          mp_event_id: `mp_evt_seed_${idx}`,
          job_type: 'process_webhook',
          payload: { event_id: `mp_evt_seed_${idx}`, payment_id: payment.id },
          status: 'completed',
          attempts: 1,
          max_attempts: 10,
          created_at: createdDate,
        },
      })
      webhookJobCount++

      if (isFinal) {
        await prisma.webhookJob.create({
          data: {
            mp_event_id: `mp_evt_seed_${idx}`,
            job_type: 'send_notification',
            payload: { target: 'buyer', endpoint: '/api/v1/orders/{id}/status', payment_id: payment.id, order_id: orderId },
            status: 'completed',
            attempts: 1,
            max_attempts: 10,
            created_at: addDays(createdDate, 1),
          },
        })
        webhookJobCount++

        if (isMultiSeller || i < 12) {
          await prisma.webhookJob.create({
            data: {
              mp_event_id: `mp_evt_seed_${idx}`,
              job_type: 'send_notification',
              payload: { target: 'seller', endpoint: '/api/v1/sales-orders', payment_id: payment.id, seller_profile_id: sellerId },
              status: 'completed',
              attempts: 1,
              max_attempts: 10,
              created_at: addDays(createdDate, 1),
            },
          })
          webhookJobCount++
        }
      }
    }

    // Edge case webhooks
    if (i === 1) {
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: `mp_evt_seed_pending_${idx}`,
          event_type: 'payment.pending',
          payload: { action: 'payment.created', data: { id: String(2000000 + i) }, live_mode: false },
          signature_valid: true,
          status: 'received',
          created_at: addDays(END, -1),
        },
      })
      webhookCount++

      await prisma.webhookJob.create({
        data: {
          mp_event_id: `mp_evt_seed_pending_${idx}`,
          job_type: 'process_webhook',
          payload: { event_id: `mp_evt_seed_pending_${idx}`, payment_id: payment.id },
          status: 'processing',
          attempts: 2,
          max_attempts: 10,
          last_error: 'Timeout fetching MP payment details',
          created_at: addDays(END, -1),
        },
      })
      webhookJobCount++
    }

    if (i === 3) {
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: `mp_evt_seed_invalid_${idx}`,
          event_type: 'merchant_order.created',
          payload: { action: 'test_webhook', data: {} },
          signature_valid: false,
          status: 'failed',
          last_error: 'HMAC signature mismatch: expected v1=abc, got v1=xyz',
          created_at: addDays(END, -2),
        },
      })
      webhookCount++
    }

    if (i === 8) {
      // A webhook that was received but processing keeps failing
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: `mp_evt_seed_stuck_${idx}`,
          event_type: 'payment.updated',
          payload: { action: 'payment.updated', data: { id: String(2000000 + i) }, live_mode: false },
          signature_valid: true,
          status: 'processing',
          last_error: 'Payment record not found for external_reference',
          created_at: addDays(END, -5),
        },
      })
      webhookCount++

      await prisma.webhookJob.create({
        data: {
          mp_event_id: `mp_evt_seed_stuck_${idx}`,
          job_type: 'process_webhook',
          payload: { event_id: `mp_evt_seed_stuck_${idx}` },
          status: 'failed',
          attempts: 10,
          max_attempts: 10,
          last_error: 'Max attempts reached. Payment not recognizable.',
          created_at: addDays(END, -5),
        },
      })
      webhookJobCount++
    }
  }

  // ── OutboundCallLog ──
  const callTargets = ['buyer', 'seller', 'shipping'] as const
  const callMethods = ['POST', 'PATCH'] as const
  const callPaths = [
    '/api/v1/orders/{id}/status',
    '/api/v1/sales-orders',
    '/api/v1/sales-orders/{id}/payment-status',
    '/api/v1/internal/shipment-delivered',
  ] as const

  for (let i = 0; i < 20; i++) {
    const succeeded = i % 5 !== 3
    await prisma.outboundCallLog.create({
      data: {
        target_app: pick(callTargets),
        method: pick(callMethods),
        path: pick(callPaths),
        request_body: { payment_id: `pay_payment_${pad(i + 1)}` },
        response_status: succeeded ? 200 : null,
        response_body: succeeded ? { ok: true } : Prisma.DbNull,
        attempts: succeeded ? 1 : 3,
        last_error: succeeded ? null : 'Connection timeout after 3 retries',
        succeeded_at: succeeded ? daysBefore(82 - i * 4) : null,
        created_at: daysBefore(82 - i * 4),
      },
    })
  }

  // ── Summary ──
  const counts = {
    payments: await prisma.payment.count(),
    paymentStatusHistory: await prisma.paymentStatusHistory.count(),
    paymentAttempts: await prisma.paymentAttempt.count(),
    receipts: await prisma.receipt.count(),
    settlements: await prisma.settlement.count(),
    settlementStatusHistory: await prisma.settlementStatusHistory.count(),
    payouts: await prisma.payout.count(),
    refunds: await prisma.refund.count(),
    refundStatusHistory: await prisma.refundStatusHistory.count(),
    mpWebhookEvents: await prisma.mpWebhookEvent.count(),
    webhookJobs: await prisma.webhookJob.count(),
    outboundCallLogs: await prisma.outboundCallLog.count(),
  }

  console.log('\n✅ Payments App seed complete!')
  console.log(`  Payments:                   ${counts.payments} (total ARS $${(totalAmountCents / 100).toLocaleString()})`)
  console.log(`  Payment status history:     ${counts.paymentStatusHistory}`)
  console.log(`  Payment attempts:           ${counts.paymentAttempts}`)
  console.log(`  Receipts:                   ${counts.receipts}`)
  console.log(`  Settlements:                ${counts.settlements}`)
  console.log(`  Settlement status hist.:    ${counts.settlementStatusHistory}`)
  console.log(`  Payouts:                    ${counts.payouts}`)
  console.log(`  Refunds:                    ${counts.refunds}`)
  console.log(`  Refund status history:      ${counts.refundStatusHistory}`)
  console.log(`  MP webhook events:          ${counts.mpWebhookEvents}`)
  console.log(`  Webhook jobs:               ${counts.webhookJobs}`)
  console.log(`  Outbound call logs:         ${counts.outboundCallLogs}`)
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
