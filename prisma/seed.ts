import { Prisma, PrismaClient } from "../src/generated/prisma/client"

const prisma = new PrismaClient()

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function hoursAgo(n: number): Date {
  const d = new Date()
  d.setHours(d.getHours() - n)
  return d
}

const pad = (n: number) => String(n).padStart(3, "0")

const BUYERS = Array.from({ length: 10 }, (_, i) => ({
  id: `buyer_${pad(i + 1)}`,
  clerk: `user_2buyer_${pad(i + 1)}`,
}))

const SELLERS = Array.from({ length: 10 }, (_, i) => ({
  id: `seller_${pad((i + 1) * 10)}`,
}))

const AMOUNTS = [50000, 120000, 300000, 500000, 750000, 1000000, 1500000, 2000000, 2500000, 3500000]

const METHODS = ["credit_card", "debit_card", "account_money", "bank_transfer"] as const

const CURRENCIES = ["ARS", "ARS", "ARS", "USD"] as const

type PaymentStatus = "pending" | "approved" | "rejected" | "cancelled" | "refunded"
type SettlementStatus = "pending" | "paid" | "failed" | "manual_review"
type PayoutStatus = "pending" | "in_progress" | "completed" | "failed" | "manual_review"
type RefundStatus = "pending" | "approved" | "failed"
type RefundReason = "seller_rejected" | "buyer_cancelled" | "not_delivered" | "manual"
type WebhookStatus = "received" | "processing" | "processed" | "failed"

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function mpCheckoutUrl(prefId: string): string {
  return `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${prefId}`
}

async function main() {
  console.log("Seeding database …")

  await prisma.$connect()
  console.log("Connected, cleaning existing data …")

  // Clean in dependency order
  const cleanOrder = [
    'outboundCallLog', 'mpWebhookEvent', 'refundStatusHistory', 'refund',
    'payout', 'settlementStatusHistory', 'settlement', 'receipt',
    'paymentAttempt', 'paymentStatusHistory', 'payment',
  ] as const
  const modelMap: Record<string, any> = {
    outboundCallLog: prisma.outboundCallLog,
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
    console.log(`  cleaning ${m} …`)
    await (modelMap[m] as any).deleteMany()
  }
  console.log("Clean done, seeding …")

  let paymentCount = 0
  let receiptCount = 0
  let settlementCount = 0
  let payoutCount = 0
  let refundCount = 0
  let webhookCount = 0

  const TOTAL = 50

  // ── Status distribution ──
  // 25 approved, 8 pending, 7 rejected, 5 cancelled, 5 refunded
  const statuses: PaymentStatus[] = [
    ...Array(25).fill("approved"),
    ...Array(8).fill("pending"),
    ...Array(7).fill("rejected"),
    ...Array(5).fill("cancelled"),
    ...Array(5).fill("refunded"),
  ]

  for (let i = 0; i < TOTAL; i++) {
    const idx = pad(i + 1)
    const buyer = BUYERS[i % BUYERS.length]
    const seller = SELLERS[i % SELLERS.length]
    const amount = AMOUNTS[i % AMOUNTS.length]
    const method = pick(METHODS)
    const currency = "ARS"
    const daysBack = 1 + Math.floor(i * 1.2)

    const status = statuses[i]

    const isFinal = status === "approved" || status === "refunded"
    const isMultiSeller = isFinal && i % 6 === 0
    const secondSeller = isMultiSeller ? SELLERS[(i + 3) % SELLERS.length] : null

    const idempotencyKey = `ik_seed_${idx}`
    const preferenceId = String(2000000 + i)
    const checkoutUrl = isFinal ? mpCheckoutUrl(preferenceId) : null

    // ── Payment ──
    const payment = await prisma.payment.create({
      data: {
        id: `pay_seed_${idx}`,
        order_id: `order_${idx}`,
        buyer_profile_id: buyer.id,
        buyer_clerk_user_id: buyer.clerk,
        amount_cents: amount,
        currency,
        status,
        ...(isFinal ? { method } : {}),
        ...(isFinal ? { card_last4: String(1000 + i).slice(-4) } : {}),
        ...(isFinal ? { gateway_reference: `mp_payment_${2000000 + i}` } : {}),
        idempotency_key: idempotencyKey,
        checkout_url: checkoutUrl,
        preference_id: isFinal ? preferenceId : null,
        ...(status === "approved" || status === "refunded" ? { approved_at: daysAgo(daysBack) } : {}),
        ...(status === "rejected" ? { rejected_at: daysAgo(daysBack) } : {}),
        ...(status === "cancelled" ? { cancelled_at: daysAgo(daysBack) } : {}),
        ...(isFinal ? {
          items_summary: [
            {
              seller_profile_id: seller.id,
              subtotal_cents: amount - Math.round(amount * 0.1),
              shipping_cost_cents: Math.round(amount * 0.1),
              order_seller_group_id: `osg_${idx}`,
              buyer_profile_id: buyer.id,
              buyer_clerk_user_id: buyer.clerk,
            },
            ...(secondSeller ? [{
              seller_profile_id: secondSeller.id,
              subtotal_cents: Math.round(amount * 0.4),
              shipping_cost_cents: Math.round(amount * 0.05),
              order_seller_group_id: `osg_${idx}b`,
              buyer_profile_id: buyer.id,
              buyer_clerk_user_id: buyer.clerk,
            }] : []),
          ],
        } : {}),
        created_at: daysAgo(daysBack),
      },
    })
    paymentCount++

    // ── PaymentStatusHistory ──
    const statusHistoryEntries: Array<{ from: PaymentStatus | null; to: PaymentStatus; reason: string }> = []

    if (status === "pending") {
      statusHistoryEntries.push({ from: null, to: "pending", reason: "payment_created" })
    } else if (status === "approved") {
      statusHistoryEntries.push({ from: null, to: "pending", reason: "payment_created" })
      statusHistoryEntries.push({ from: "pending", to: "approved", reason: "payment_approved" })
    } else if (status === "rejected") {
      statusHistoryEntries.push({ from: null, to: "pending", reason: "payment_created" })
      statusHistoryEntries.push({ from: "pending", to: "rejected", reason: "payment_rejected" })
    } else if (status === "cancelled") {
      statusHistoryEntries.push({ from: null, to: "pending", reason: "payment_created" })
      statusHistoryEntries.push({ from: "pending", to: "cancelled", reason: "buyer_cancelled" })
    } else if (status === "refunded") {
      statusHistoryEntries.push({ from: null, to: "pending", reason: "payment_created" })
      statusHistoryEntries.push({ from: "pending", to: "approved", reason: "payment_approved" })
      statusHistoryEntries.push({ from: "approved", to: "refunded", reason: "full_refund" })
    }

    for (const entry of statusHistoryEntries) {
      await prisma.paymentStatusHistory.create({
        data: {
          payment_id: payment.id,
          from_status: entry.from,
          to_status: entry.to,
          changed_by: "system",
          reason: entry.reason,
          created_at: daysAgo(daysBack - (entry.from ? 0 : 0)),
        },
      })
    }

    // ── PaymentAttempt (for approved and rejected) ──
    if (status === "approved") {
      await prisma.paymentAttempt.create({
        data: {
          payment_id: payment.id,
          attempt_number: 1,
          provider: "mercadopago",
          status: "approved",
          request_payload: { items: [{ title: `Order ${idx}`, quantity: 1, unit_price: amount / 100 }] },
          response_payload: { id: preferenceId, init_point: checkoutUrl, status: "approved" },
          created_at: daysAgo(daysBack),
        },
      })
    } else if (status === "rejected") {
      const errors = [
        { code: "cc_rejected_card_disabled", message: "La tarjeta se encuentra deshabilitada" },
        { code: "cc_rejected_insufficient_amount", message: "Fondos insuficientes" },
        { code: "cc_rejected_other_reason", message: "La tarjeta fue rechazada" },
      ]
      const err = errors[i % errors.length]
      await prisma.paymentAttempt.create({
        data: {
          payment_id: payment.id,
          attempt_number: 1,
          provider: "mercadopago",
          status: "rejected",
          error_code: err.code,
          error_message: err.message,
          request_payload: { items: [{ title: `Order ${idx}`, quantity: 1, unit_price: amount / 100 }] },
          response_payload: { status: "rejected", status_detail: err.code },
          created_at: daysAgo(daysBack),
        },
      })
    }

    // ── Receipt (for approved and refunded) ──
    if (isFinal) {
      await prisma.receipt.create({
        data: {
          payment_id: payment.id,
          receipt_number: `RCP-${String(10000 + i).slice(1)}`,
          receipt_url: `https://api.mercadopago.com/v1/payments/${2000000 + i}/receipt`,
          amount_cents: amount,
          idempotency_key: `ik_receipt_${idx}`,
          issued_at: daysAgo(daysBack),
          created_at: daysAgo(daysBack),
        },
      })
      receiptCount++
    }

    // ── Settlement (for approved and refunded) ──
    if (isFinal) {
      const fee = Math.round(amount * 0.1)
      const net = amount - fee
      let sStatus: SettlementStatus

      if (status === "refunded") {
        sStatus = "paid"
      } else {
        // Mix: ~50% paid, ~20% pending, ~15% failed, ~15% manual_review
        const statusRoll = i % 10
        if (statusRoll < 5) sStatus = "paid"
        else if (statusRoll < 7) sStatus = "pending"
        else if (statusRoll < 8) sStatus = "failed"
        else sStatus = "manual_review"
      }

      const settlement = await prisma.settlement.create({
        data: {
          payment_id: payment.id,
          order_id: `order_${idx}`,
          order_seller_group_id: `osg_${idx}`,
          seller_profile_id: seller.id,
          gross_amount_cents: amount,
          fee_amount_cents: fee,
          net_amount_cents: net,
          currency,
          status: sStatus,
          ...(sStatus === "paid" ? { paid_at: daysAgo(daysBack - 2) } : {}),
          created_at: daysAgo(daysBack),
        },
      })
      settlementCount++

      // SettlementStatusHistory
      const sFrom: SettlementStatus | null = sStatus === "pending" ? null : "pending"
      const sReason = sStatus === "paid" ? "settlement_paid" : sStatus === "pending" ? "settlement_created" : sStatus === "failed" ? "settlement_failed" : "settlement_marked_manual_review"
      await prisma.settlementStatusHistory.create({
        data: {
          settlement_id: settlement.id,
          from_status: sFrom,
          to_status: sStatus,
          changed_by: "system",
          reason: sReason,
          created_at: daysAgo(daysBack - (sFrom ? 2 : 0)),
        },
      })

      // ── Payout (for paid settlements) ──
      if (sStatus === "paid") {
        const pStatus: PayoutStatus = i % 8 === 0 ? "pending" : "completed"
        await prisma.payout.create({
          data: {
            settlement_id: settlement.id,
            transfer_id: pStatus === "completed" ? `trf_${2000000 + i}` : null,
            status: pStatus,
            attempts: pStatus === "completed" ? 1 : 0,
            idempotency_key: `ik_payout_${idx}`,
            ...(pStatus === "completed" ? { started_at: daysAgo(daysBack - 2), completed_at: daysAgo(daysBack - 1) } : {}),
            created_at: daysAgo(daysBack - 1),
          },
        })
        payoutCount++
      }

      // Second seller settlement for multi-seller payments
      if (secondSeller) {
        const s2 = await prisma.settlement.create({
          data: {
            payment_id: payment.id,
            order_id: `order_${idx}`,
            order_seller_group_id: `osg_${idx}b`,
            seller_profile_id: secondSeller.id,
            gross_amount_cents: Math.round(amount * 0.45),
            fee_amount_cents: Math.round(amount * 0.045),
            net_amount_cents: Math.round(amount * 0.405),
            currency,
            status: "pending",
            created_at: daysAgo(daysBack),
          },
        })
        settlementCount++
        await prisma.settlementStatusHistory.create({
          data: {
            settlement_id: s2.id,
            from_status: null,
            to_status: "pending",
            changed_by: "system",
            reason: "settlement_created",
          },
        })
      }

      // ── Refund (for refunded payments + some approved) ──
      if (status === "refunded" || (status === "approved" && i % 4 === 3)) {
        const isFull = status === "refunded"
        const refAmount = isFull ? amount : Math.round(amount * 0.3)
        const refStatus: RefundStatus = i % 10 === 0 ? "failed" : i % 10 === 1 ? "pending" : "approved"
        const reasons: RefundReason[] = ["seller_rejected", "buyer_cancelled", "not_delivered", "manual"]
        const reason = isFull ? "seller_rejected" : reasons[i % reasons.length]

        const refund = await prisma.refund.create({
          data: {
            payment_id: payment.id,
            seller_profile_id: seller.id,
            amount_cents: refAmount,
            currency,
            reason,
            status: refStatus,
            gateway_reference: refStatus !== "pending" ? `mp_refund_${3000000 + i}` : null,
            idempotency_key: `ik_refund_${idx}`,
            created_at: daysAgo(daysBack - (isFull ? 1 : 0)),
          },
        })
        refundCount++

        // RefundStatusHistory
        const rFrom: RefundStatus | null = refStatus === "pending" ? null : "pending"
        await prisma.refundStatusHistory.create({
          data: {
            refund_id: refund.id,
            from_status: rFrom,
            to_status: refStatus,
            changed_by: "system",
            reason: refStatus === "approved" ? "refund_processed" : refStatus === "failed" ? "refund_failed" : "refund_requested",
            created_at: daysAgo(daysBack - (rFrom ? 1 : 0)),
          },
        })
      }
    }

    // ── MpWebhookEvent (for finalized payments) ──
    if (status === "approved" || status === "rejected" || status === "refunded") {
      const eventType = status === "approved" ? "payment.approved" : status === "rejected" ? "payment.rejected" : "payment.refunded"
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: `mp_evt_seed_${idx}`,
          event_type: eventType,
          payload: { action: eventType, data: { id: String(2000000 + i) }, live_mode: true },
          signature_valid: true,
          status: "processed",
          processed_at: daysAgo(daysBack - 1),
          created_at: daysAgo(daysBack),
        },
      })
      webhookCount++
    }

    // A few extra webhook edge cases
    if (i === 2) {
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: `mp_evt_seed_pending_${idx}`,
          event_type: "payment.pending",
          payload: { action: "payment.created", data: { id: String(2000000 + i) } },
          signature_valid: true,
          status: "received",
          created_at: hoursAgo(2),
        },
      })
      webhookCount++
    }
    if (i === 4) {
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: `mp_evt_seed_invalid_${idx}`,
          event_type: "merchant_order.created",
          payload: { action: "test", data: {} },
          signature_valid: false,
          status: "failed",
          last_error: "HMAC signature mismatch",
          created_at: hoursAgo(6),
        },
      })
      webhookCount++
    }
  }

  // ── OutboundCallLog (sample audit records) ──
  const callTargets = ["buyer", "seller"] as const
  const callMethods = ["POST", "PATCH"] as const
  const callPaths = [
    "/api/v1/orders/{id}/status",
    "/api/v1/sales-orders",
    "/api/v1/sales-orders/{id}/payment-status",
  ] as const

  for (let i = 0; i < 15; i++) {
    const succeeded = i % 5 !== 0
    await prisma.outboundCallLog.create({
      data: {
        target_app: pick(callTargets),
        method: pick(callMethods),
        path: pick(callPaths),
        request_body: { payment_id: `pay_seed_${pad(i + 1)}`, status: "approved" },
        response_status: succeeded ? 200 : null,
        response_body: succeeded ? { ok: true } : Prisma.DbNull,
        attempts: succeeded ? 1 : 3,
        last_error: succeeded ? null : "Connection timeout",
        succeeded_at: succeeded ? daysAgo(i) : null,
        created_at: daysAgo(i),
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
    webhooks: await prisma.mpWebhookEvent.count(),
    outboundCalls: await prisma.outboundCallLog.count(),
  }

  console.log("\nSeed complete!")
  console.log(`  Payments:                ${counts.payments}`)
  console.log(`  Payment status history:  ${counts.paymentStatusHistory}`)
  console.log(`  Payment attempts:        ${counts.paymentAttempts}`)
  console.log(`  Receipts:                ${counts.receipts}`)
  console.log(`  Settlements:             ${counts.settlements}`)
  console.log(`  Settlement status hist.: ${counts.settlementStatusHistory}`)
  console.log(`  Payouts:                 ${counts.payouts}`)
  console.log(`  Refunds:                 ${counts.refunds}`)
  console.log(`  Refund status history:   ${counts.refundStatusHistory}`)
  console.log(`  Webhook events:          ${counts.webhooks}`)
  console.log(`  Outbound call logs:      ${counts.outboundCalls}`)
}

main()
  .catch((e) => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
