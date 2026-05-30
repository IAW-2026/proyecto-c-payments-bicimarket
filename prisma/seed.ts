import { PrismaClient } from "../src/generated/prisma/client"

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

const BUYERS = [
  { id: "buyer_001", clerk: "user_2buyerClerkId001" },
  { id: "buyer_002", clerk: "user_2buyerClerkId002" },
  { id: "buyer_003", clerk: "user_2buyerClerkId003" },
]

const SELLERS = [
  { id: "seller_010" },
  { id: "seller_020" },
  { id: "seller_030" },
]

const pad = (n: number) => String(n).padStart(3, "0")

const ALL_BUYERS = [
  ...BUYERS,
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `buyer_${pad(i + 4)}`,
    clerk: `user_2buyerClerkId${pad(i + 4)}`,
  })),
]

const ALL_SELLERS = [
  ...SELLERS,
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `seller_${pad((i + 4) * 10)}`,
  })),
]

const AMOUNTS = [50000, 120000, 300000, 500000, 750000, 1000000, 1500000, 2000000, 2500000, 3500000]

const METHODS: Array<"credit_card" | "debit_card" | "account_money" | "bank_transfer"> = [
  "credit_card", "debit_card", "account_money", "bank_transfer",
]

const REFUND_REASONS: Array<"buyer_cancelled" | "not_delivered" | "seller_rejected" | "manual"> = [
  "buyer_cancelled", "not_delivered", "seller_rejected", "manual",
]

const PAYOUT_REASONS = [
  "requested_by_admin", "requested_by_seller", "scheduled_payout", "manual_processing",
]

async function main() {
  console.log("Seeding database …")

  // Clean existing data in dependency order
  await prisma.outboundCallLog.deleteMany()
  await prisma.mpWebhookEvent.deleteMany()
  await prisma.idempotencyKey.deleteMany()
  await prisma.refundStatusHistory.deleteMany()
  await prisma.refund.deleteMany()
  await prisma.payout.deleteMany()
  await prisma.settlementStatusHistory.deleteMany()
  await prisma.settlement.deleteMany()
  await prisma.receipt.deleteMany()
  await prisma.paymentAttempt.deleteMany()
  await prisma.paymentStatusHistory.deleteMany()
  await prisma.payment.deleteMany()

  // ─── 1. Approved payment — fully settled and paid out ───
  const p1 = await prisma.payment.create({
    data: {
      id: "pay_seed_001",
      order_id: "order_001",
      buyer_profile_id: BUYERS[0].id,
      buyer_clerk_user_id: BUYERS[0].clerk,
      amount_cents: 1500000,
      currency: "ARS",
      status: "approved",
      method: "credit_card",
      card_last4: "1234",
      gateway_reference: "mp_ref_001",
      approved_at: daysAgo(5),
      created_at: daysAgo(5),
      items_summary: [
        {
          seller_profile_id: SELLERS[0].id,
          subtotal_cents: 1200000,
          shipping_cost_cents: 300000,
          order_seller_group_id: "sg_001",
          buyer_profile_id: BUYERS[0].id,
          buyer_clerk_user_id: BUYERS[0].clerk,
        },
      ],
    },
  })

  await prisma.paymentStatusHistory.create({
    data: {
      payment_id: p1.id,
      from_status: null,
      to_status: "approved",
      changed_by: "system",
      reason: "payment_approved",
      created_at: daysAgo(5),
    },
  })

  await prisma.receipt.create({
    data: {
      payment_id: p1.id,
      receipt_number: "RCP-0001",
      receipt_url: "https://example.com/receipts/rcp-0001.pdf",
      amount_cents: 1500000,
      issued_at: daysAgo(5),
      created_at: daysAgo(5),
    },
  })

  const s1 = await prisma.settlement.create({
    data: {
      payment_id: p1.id,
      order_id: "order_001",
      order_seller_group_id: "sg_001",
      seller_profile_id: SELLERS[0].id,
      gross_amount_cents: 1500000,
      fee_amount_cents: 150000,
      net_amount_cents: 1350000,
      status: "paid",
      paid_at: daysAgo(3),
      created_at: daysAgo(5),
    },
  })

  await prisma.payout.create({
    data: {
      settlement_id: s1.id,
      transfer_id: "trf_001",
      status: "completed",
      attempts: 1,
      started_at: daysAgo(3),
      completed_at: daysAgo(3),
      created_at: daysAgo(3),
    },
  })

  // ─── 2. Approved payment — settlement pending, no payout yet ───
  const p2 = await prisma.payment.create({
    data: {
      id: "pay_seed_002",
      order_id: "order_002",
      buyer_profile_id: BUYERS[1].id,
      buyer_clerk_user_id: BUYERS[1].clerk,
      amount_cents: 500000,
      currency: "ARS",
      status: "approved",
      method: "debit_card",
      card_last4: "5678",
      gateway_reference: "mp_ref_002",
      approved_at: daysAgo(1),
      created_at: daysAgo(1),
      items_summary: [
        {
          seller_profile_id: SELLERS[1].id,
          subtotal_cents: 500000,
          shipping_cost_cents: 0,
          order_seller_group_id: "sg_002",
          buyer_profile_id: BUYERS[1].id,
          buyer_clerk_user_id: BUYERS[1].clerk,
        },
      ],
    },
  })

  await prisma.receipt.create({
    data: {
      payment_id: p2.id,
      receipt_number: "RCP-0002",
      receipt_url: "https://example.com/receipts/rcp-0002.pdf",
      amount_cents: 500000,
      issued_at: daysAgo(1),
      created_at: daysAgo(1),
    },
  })

  await prisma.settlement.create({
    data: {
      payment_id: p2.id,
      order_id: "order_002",
      order_seller_group_id: "sg_002",
      seller_profile_id: SELLERS[1].id,
      gross_amount_cents: 500000,
      fee_amount_cents: 50000,
      net_amount_cents: 450000,
      status: "pending",
      created_at: daysAgo(1),
    },
  })

  // ─── 3. Pending payment — buyer hasn't completed checkout ───
  await prisma.payment.create({
    data: {
      id: "pay_seed_003",
      order_id: "order_003",
      buyer_profile_id: BUYERS[2].id,
      buyer_clerk_user_id: BUYERS[2].clerk,
      amount_cents: 2500000,
      currency: "ARS",
      status: "pending",
      method: "account_money",
      created_at: hoursAgo(2),
    },
  })

  // ─── 4. Rejected payment ───
  const p4 = await prisma.payment.create({
    data: {
      id: "pay_seed_004",
      order_id: "order_004",
      buyer_profile_id: BUYERS[0].id,
      buyer_clerk_user_id: BUYERS[0].clerk,
      amount_cents: 80000,
      currency: "ARS",
      status: "rejected",
      method: "credit_card",
      card_last4: "0000",
      gateway_reference: "mp_ref_004",
      rejected_at: daysAgo(2),
      created_at: daysAgo(2),
    },
  })

  await prisma.paymentAttempt.create({
    data: {
      payment_id: p4.id,
      attempt_number: 1,
      provider: "mercadopago",
      status: "rejected",
      error_code: "cc_rejected_card_disabled",
      error_message: "La tarjeta se encuentra deshabilitada",
      created_at: daysAgo(2),
    },
  })

  await prisma.paymentStatusHistory.create({
    data: {
      payment_id: p4.id,
      from_status: "pending",
      to_status: "rejected",
      changed_by: "system",
      reason: "card_disabled",
      created_at: daysAgo(2),
    },
  })

  // ─── 5. Cancelled payment ───
  await prisma.payment.create({
    data: {
      id: "pay_seed_005",
      order_id: "order_005",
      buyer_profile_id: BUYERS[1].id,
      buyer_clerk_user_id: BUYERS[1].clerk,
      amount_cents: 120000,
      currency: "ARS",
      status: "cancelled",
      method: "bank_transfer",
      cancelled_at: daysAgo(4),
      created_at: daysAgo(4),
    },
  })

  // ─── 6. Refunded payment — full refund, approved ───
  const p6 = await prisma.payment.create({
    data: {
      id: "pay_seed_006",
      order_id: "order_006",
      buyer_profile_id: BUYERS[2].id,
      buyer_clerk_user_id: BUYERS[2].clerk,
      amount_cents: 300000,
      currency: "ARS",
      status: "refunded",
      method: "credit_card",
      card_last4: "9012",
      gateway_reference: "mp_ref_006",
      approved_at: daysAgo(10),
      created_at: daysAgo(10),
    },
  })

  await prisma.receipt.create({
    data: {
      payment_id: p6.id,
      receipt_number: "RCP-0006",
      receipt_url: "https://example.com/receipts/rcp-0006.pdf",
      amount_cents: 300000,
      issued_at: daysAgo(10),
      created_at: daysAgo(10),
    },
  })

  const s6 = await prisma.settlement.create({
    data: {
      payment_id: p6.id,
      order_id: "order_006",
      order_seller_group_id: "sg_006",
      seller_profile_id: SELLERS[2].id,
      gross_amount_cents: 300000,
      fee_amount_cents: 30000,
      net_amount_cents: 270000,
      status: "paid",
      paid_at: daysAgo(8),
      created_at: daysAgo(10),
    },
  })

  await prisma.payout.create({
    data: {
      settlement_id: s6.id,
      transfer_id: "trf_006",
      status: "completed",
      attempts: 1,
      started_at: daysAgo(8),
      completed_at: daysAgo(8),
    },
  })

  const ref6 = await prisma.refund.create({
    data: {
      payment_id: p6.id,
      seller_profile_id: SELLERS[2].id,
      amount_cents: 300000,
      reason: "seller_rejected",
      status: "approved",
      gateway_reference: "mp_refund_006",
      created_at: daysAgo(7),
    },
  })

  await prisma.refundStatusHistory.create({
    data: {
      refund_id: ref6.id,
      from_status: "pending",
      to_status: "approved",
      changed_by: "system",
      reason: "refund_processed_by_mp",
      created_at: daysAgo(7),
    },
  })

  // ─── 7. Approved payment — settlement failed ───
  const p7 = await prisma.payment.create({
    data: {
      id: "pay_seed_007",
      order_id: "order_007",
      buyer_profile_id: BUYERS[0].id,
      buyer_clerk_user_id: BUYERS[0].clerk,
      amount_cents: 750000,
      currency: "ARS",
      status: "approved",
      method: "debit_card",
      card_last4: "3456",
      gateway_reference: "mp_ref_007",
      approved_at: daysAgo(6),
      created_at: daysAgo(6),
    },
  })

  await prisma.receipt.create({
    data: {
      payment_id: p7.id,
      receipt_number: "RCP-0007",
      receipt_url: "https://example.com/receipts/rcp-0007.pdf",
      amount_cents: 750000,
      issued_at: daysAgo(6),
    },
  })

  await prisma.settlement.create({
    data: {
      payment_id: p7.id,
      order_id: "order_007",
      order_seller_group_id: "sg_007",
      seller_profile_id: SELLERS[0].id,
      gross_amount_cents: 750000,
      fee_amount_cents: 75000,
      net_amount_cents: 675000,
      status: "failed",
      created_at: daysAgo(6),
    },
  })

  // ─── 8. Approved payment — settlement manual_review ───
  const p8 = await prisma.payment.create({
    data: {
      id: "pay_seed_008",
      order_id: "order_008",
      buyer_profile_id: BUYERS[1].id,
      buyer_clerk_user_id: BUYERS[1].clerk,
      amount_cents: 2000000,
      currency: "ARS",
      status: "approved",
      method: "bank_transfer",
      gateway_reference: "mp_ref_008",
      approved_at: daysAgo(3),
      created_at: daysAgo(3),
    },
  })

  await prisma.receipt.create({
    data: {
      payment_id: p8.id,
      receipt_number: "RCP-0008",
      receipt_url: "https://example.com/receipts/rcp-0008.pdf",
      amount_cents: 2000000,
      issued_at: daysAgo(3),
    },
  })

  await prisma.settlement.create({
    data: {
      payment_id: p8.id,
      order_id: "order_008",
      order_seller_group_id: "sg_008",
      seller_profile_id: SELLERS[1].id,
      gross_amount_cents: 2000000,
      fee_amount_cents: 200000,
      net_amount_cents: 1800000,
      status: "manual_review",
      created_at: daysAgo(3),
    },
  })

  // ─── 9. Multi-seller payment (2 sellers, 1 payment) ───
  const p9 = await prisma.payment.create({
    data: {
      id: "pay_seed_009",
      order_id: "order_009",
      buyer_profile_id: BUYERS[0].id,
      buyer_clerk_user_id: BUYERS[0].clerk,
      amount_cents: 4200000,
      currency: "ARS",
      status: "approved",
      method: "credit_card",
      card_last4: "7890",
      gateway_reference: "mp_ref_009",
      approved_at: daysAgo(4),
      created_at: daysAgo(4),
      items_summary: [
        {
          seller_profile_id: SELLERS[0].id,
          subtotal_cents: 2000000,
          shipping_cost_cents: 0,
          order_seller_group_id: "sg_009a",
          buyer_profile_id: BUYERS[0].id,
          buyer_clerk_user_id: BUYERS[0].clerk,
        },
        {
          seller_profile_id: SELLERS[1].id,
          subtotal_cents: 2000000,
          shipping_cost_cents: 200000,
          order_seller_group_id: "sg_009b",
          buyer_profile_id: BUYERS[0].id,
          buyer_clerk_user_id: BUYERS[0].clerk,
        },
      ],
    },
  })

  await prisma.receipt.create({
    data: {
      payment_id: p9.id,
      receipt_number: "RCP-0009",
      receipt_url: "https://example.com/receipts/rcp-0009.pdf",
      amount_cents: 4200000,
      issued_at: daysAgo(4),
    },
  })

  const s9a = await prisma.settlement.create({
    data: {
      payment_id: p9.id,
      order_id: "order_009",
      order_seller_group_id: "sg_009a",
      seller_profile_id: SELLERS[0].id,
      gross_amount_cents: 2000000,
      fee_amount_cents: 200000,
      net_amount_cents: 1800000,
      status: "pending",
      created_at: daysAgo(4),
    },
  })

  await prisma.settlement.create({
    data: {
      payment_id: p9.id,
      order_id: "order_009",
      order_seller_group_id: "sg_009b",
      seller_profile_id: SELLERS[1].id,
      gross_amount_cents: 2200000,
      fee_amount_cents: 220000,
      net_amount_cents: 1980000,
      status: "pending",
      created_at: daysAgo(4),
    },
  })

  await prisma.payout.create({
    data: {
      settlement_id: s9a.id,
      status: "pending",
      attempts: 0,
      created_at: daysAgo(4),
    },
  })

  // ─── 10. Partial refund (approved payment with partial refund) ───
  const p10 = await prisma.payment.create({
    data: {
      id: "pay_seed_010",
      order_id: "order_010",
      buyer_profile_id: BUYERS[2].id,
      buyer_clerk_user_id: BUYERS[2].clerk,
      amount_cents: 600000,
      currency: "ARS",
      status: "approved",
      method: "account_money",
      gateway_reference: "mp_ref_010",
      approved_at: daysAgo(2),
      created_at: daysAgo(2),
    },
  })

  await prisma.receipt.create({
    data: {
      payment_id: p10.id,
      receipt_number: "RCP-0010",
      receipt_url: "https://example.com/receipts/rcp-0010.pdf",
      amount_cents: 600000,
      issued_at: daysAgo(2),
    },
  })

  await prisma.settlement.create({
    data: {
      payment_id: p10.id,
      order_id: "order_010",
      order_seller_group_id: "sg_010",
      seller_profile_id: SELLERS[2].id,
      gross_amount_cents: 600000,
      fee_amount_cents: 60000,
      net_amount_cents: 540000,
      status: "pending",
      created_at: daysAgo(2),
    },
  })

  const ref10 = await prisma.refund.create({
    data: {
      payment_id: p10.id,
      seller_profile_id: SELLERS[2].id,
      amount_cents: 150000,
      reason: "buyer_cancelled",
      status: "pending",
      created_at: hoursAgo(6),
    },
  })

  await prisma.refundStatusHistory.create({
    data: {
      refund_id: ref10.id,
      from_status: null,
      to_status: "pending",
      changed_by: "admin",
      reason: "partial_refund_requested",
      created_at: hoursAgo(6),
    },
  })

  // ─── 11. Failed refund example ───
  const p11 = await prisma.payment.create({
    data: {
      id: "pay_seed_011",
      order_id: "order_011",
      buyer_profile_id: BUYERS[0].id,
      buyer_clerk_user_id: BUYERS[0].clerk,
      amount_cents: 450000,
      currency: "ARS",
      status: "approved",
      method: "credit_card",
      card_last4: "1111",
      gateway_reference: "mp_ref_011",
      approved_at: daysAgo(15),
      created_at: daysAgo(15),
    },
  })

  await prisma.settlement.create({
    data: {
      payment_id: p11.id,
      order_id: "order_011",
      order_seller_group_id: "sg_011",
      seller_profile_id: SELLERS[0].id,
      gross_amount_cents: 450000,
      fee_amount_cents: 45000,
      net_amount_cents: 405000,
      status: "paid",
      paid_at: daysAgo(13),
      created_at: daysAgo(15),
    },
  })

  const ref11 = await prisma.refund.create({
    data: {
      payment_id: p11.id,
      seller_profile_id: SELLERS[0].id,
      amount_cents: 450000,
      reason: "not_delivered",
      status: "failed",
      gateway_reference: "mp_refund_011",
      created_at: daysAgo(10),
    },
  })

  await prisma.refundStatusHistory.create({
    data: {
      refund_id: ref11.id,
      from_status: "pending",
      to_status: "failed",
      changed_by: "system",
      reason: "refund_period_expired",
      created_at: daysAgo(10),
    },
  })

  // ─── 12. Webhook events ───
  await prisma.mpWebhookEvent.create({
    data: {
      mp_event_id: "mp_evt_001",
      event_type: "payment.approved",
      payload: { action: "payment.created", data: { id: "pay_seed_001" } },
      signature_valid: true,
      status: "processed",
      processed_at: daysAgo(5),
      created_at: daysAgo(5),
    },
  })

  await prisma.mpWebhookEvent.create({
    data: {
      mp_event_id: "mp_evt_002",
      event_type: "payment.rejected",
      payload: { action: "payment.rejected", data: { id: "pay_seed_004" } },
      signature_valid: true,
      status: "processed",
      processed_at: daysAgo(2),
      created_at: daysAgo(2),
    },
  })

  await prisma.mpWebhookEvent.create({
    data: {
      mp_event_id: "mp_evt_003",
      event_type: "payment.refunded",
      payload: { action: "payment.refunded", data: { id: "pay_seed_006" } },
      signature_valid: true,
      status: "processed",
      processed_at: daysAgo(7),
      created_at: daysAgo(7),
    },
  })

  await prisma.mpWebhookEvent.create({
    data: {
      mp_event_id: "mp_evt_004",
      event_type: "unknown.event",
      payload: { action: "test", data: {} },
      signature_valid: false,
      status: "failed",
      last_error: "Invalid signature",
      created_at: daysAgo(1),
    },
  })

  // ─── 13. Idempotency keys ───
  await prisma.idempotencyKey.create({
    data: {
      key: "idemp_001",
      response: { id: "pay_seed_001", status: "approved" },
      status: 200,
      expires_at: daysAgo(-25),
      created_at: daysAgo(5),
    },
  })

  // ─── Fill gaps in existing data ───
  // Receipt for pay_seed_011 (was missing)
  await prisma.receipt.upsert({
    where: { id: "rcpt_seed_011" },
    create: { id: "rcpt_seed_011", payment_id: "pay_seed_011", receipt_number: "RCP-0011", receipt_url: "https://example.com/receipts/rcp-0011.pdf", amount_cents: 450000, issued_at: daysAgo(15), created_at: daysAgo(15) },
    update: {},
  })

  // Payouts for existing settlements that lack them
  const settlementsWithoutPayout = await prisma.settlement.findMany({
    where: { payouts: { none: {} }, status: { in: ["paid", "pending"] } },
  })
  for (const s of settlementsWithoutPayout) {
    await prisma.payout.create({
      data: {
        settlement_id: s.id,
        transfer_id: s.status === "paid" ? `trf_fill_${s.id.slice(0, 8)}` : undefined,
        status: s.status === "paid" ? "completed" : "pending",
        attempts: s.status === "paid" ? 1 : 0,
        ...(s.status === "paid" ? { started_at: daysAgo(12), completed_at: daysAgo(12) } : {}),
        created_at: s.created_at,
      },
    })
  }

  // ─── Bulk data generation (~30 per category) ───
  const BULK_COUNT = 35
  let bulkRefundCount = 0, bulkWebhookCount = 0, bulkIdempotentCount = 0

  for (let i = 0; i < BULK_COUNT; i++) {
    const idx = pad(i + 1)
    const buyer = ALL_BUYERS[i % ALL_BUYERS.length]
    const singleSeller = ALL_SELLERS[i % ALL_SELLERS.length]

    // status distribution
    let status: "approved" | "pending" | "rejected" | "refunded" | "cancelled"
    if (i < 20) status = "approved"
    else if (i < 24) status = "pending"
    else if (i < 27) status = "rejected"
    else if (i < 30) status = "refunded"
    else status = "cancelled"

    const amount = AMOUNTS[i % AMOUNTS.length]
    const method = METHODS[i % METHODS.length]
    const daysBack = 1 + i * 2 // spread over ~70 days
    const isMultiSeller = status === "approved" && i % 5 === 0 // every 5th approved is multi-seller
    const secondSeller = isMultiSeller ? ALL_SELLERS[(i + 3) % ALL_SELLERS.length] : null

    const payment = await prisma.payment.create({
      data: {
        id: `pay_bulk_${idx}`,
        order_id: `order_bulk_${idx}`,
        buyer_profile_id: buyer.id,
        buyer_clerk_user_id: buyer.clerk,
        amount_cents: amount,
        currency: "ARS",
        status,
        method,
        ...(status === "approved" || status === "refunded" ? {
          card_last4: String(1000 + i).slice(-4),
          gateway_reference: `mp_bulk_${idx}`,
          approved_at: daysAgo(daysBack),
        } : {}),
        ...(status === "rejected" ? {
          card_last4: "0000",
          gateway_reference: `mp_bulk_${idx}`,
          rejected_at: daysAgo(daysBack),
        } : {}),
        ...(status === "cancelled" ? {
          cancelled_at: daysAgo(daysBack),
        } : {}),
        ...(status !== "pending" ? {
          items_summary: [
            {
              seller_profile_id: singleSeller.id,
              subtotal_cents: amount - Math.round(amount * 0.1),
              shipping_cost_cents: Math.round(amount * 0.1),
              order_seller_group_id: `sg_bulk_${idx}`,
              buyer_profile_id: buyer.id,
              buyer_clerk_user_id: buyer.clerk,
            },
            ...(secondSeller ? [{
              seller_profile_id: secondSeller.id,
              subtotal_cents: Math.round(amount * 0.4),
              shipping_cost_cents: Math.round(amount * 0.05),
              order_seller_group_id: `sg_bulk_${idx}b`,
              buyer_profile_id: buyer.id,
              buyer_clerk_user_id: buyer.clerk,
            }] : []),
          ],
        } : {}),
        created_at: daysAgo(daysBack),
      },
    })

    // status history
    if (status === "approved") {
      await prisma.paymentStatusHistory.create({
        data: { payment_id: payment.id, from_status: "pending", to_status: "approved", changed_by: "system", reason: "payment_approved", created_at: daysAgo(daysBack) },
      })
    } else if (status === "rejected") {
      await prisma.paymentStatusHistory.create({
        data: { payment_id: payment.id, from_status: "pending", to_status: "rejected", changed_by: "system", reason: "card_rejected", created_at: daysAgo(daysBack) },
      })
    } else if (status === "refunded") {
      await prisma.paymentStatusHistory.create({
        data: { payment_id: payment.id, from_status: "approved", to_status: "refunded", changed_by: "system", reason: "full_refund", created_at: daysAgo(daysBack - 1) },
      })
    }

    // attempt for rejected
    if (status === "rejected") {
      await prisma.paymentAttempt.create({
        data: { payment_id: payment.id, attempt_number: 1, provider: "mercadopago", status: "rejected", error_code: "cc_rejected_generic", error_message: "La tarjeta fue rechazada", created_at: daysAgo(daysBack) },
      })
    }

    // receipt + settlement + payout for approved / refunded
    if (status === "approved" || status === "refunded") {
      const fee = Math.round(amount * 0.1)
      const net = amount - fee

      await prisma.receipt.create({
        data: {
          payment_id: payment.id,
          receipt_number: `RCP-BLK-${idx}`,
          receipt_url: `https://example.com/receipts/rcp-blk-${idx}.pdf`,
          amount_cents: amount,
          issued_at: daysAgo(daysBack),
          created_at: daysAgo(daysBack),
        },
      })

      const sStatus: "paid" | "pending" | "failed" | "manual_review" =
        i % 7 === 0 ? "pending" : i % 7 === 1 ? "failed" : i % 7 === 2 ? "manual_review" : "paid"

      const s1 = await prisma.settlement.create({
        data: {
          payment_id: payment.id,
          order_id: `order_bulk_${idx}`,
          order_seller_group_id: `sg_bulk_${idx}`,
          seller_profile_id: singleSeller.id,
          gross_amount_cents: amount,
          fee_amount_cents: fee,
          net_amount_cents: net,
          status: sStatus,
          ...(sStatus === "paid" ? { paid_at: daysAgo(daysBack - 2) } : {}),
          created_at: daysAgo(daysBack),
        },
      })

      if (sStatus === "paid" || sStatus === "pending") {
        await prisma.payout.create({
          data: {
            settlement_id: s1.id,
            transfer_id: sStatus === "paid" ? `trf_bulk_${idx}` : undefined,
            status: sStatus === "paid" ? "completed" : "pending",
            attempts: sStatus === "paid" ? 1 : 0,
            ...(sStatus === "paid" ? { started_at: daysAgo(daysBack - 2), completed_at: daysAgo(daysBack - 2) } : {}),
            last_error: sStatus === "pending" && i % 3 === 0 ? "Saldo insuficiente en la cuenta de origen" : undefined,
            created_at: daysAgo(daysBack),
          },
        })
      }

      // second settlement for multi-seller
      if (secondSeller) {
        const s2 = await prisma.settlement.create({
          data: {
            payment_id: payment.id,
            order_id: `order_bulk_${idx}`,
            order_seller_group_id: `sg_bulk_${idx}b`,
            seller_profile_id: secondSeller.id,
            gross_amount_cents: Math.round(amount * 0.45),
            fee_amount_cents: Math.round(amount * 0.045),
            net_amount_cents: Math.round(amount * 0.405),
            status: "pending",
            created_at: daysAgo(daysBack),
          },
        })
        await prisma.payout.create({
          data: {
            settlement_id: s2.id,
            status: "in_progress",
            attempts: 1,
            started_at: daysAgo(daysBack - 1),
            last_error: "La transferencia está siendo procesada",
            created_at: daysAgo(daysBack),
          },
        })
      }

      // refund for refunded status and some approved
      if (status === "refunded" || (status === "approved" && i % 4 === 3)) {
        const refAmount = status === "refunded" ? amount : Math.round(amount * 0.3)
        const refStatus: "approved" | "pending" | "failed" =
          i % 10 === 0 ? "failed" : i % 10 === 1 ? "pending" : "approved"

        const refund = await prisma.refund.create({
          data: {
            payment_id: payment.id,
            seller_profile_id: singleSeller.id,
            amount_cents: refAmount,
            reason: REFUND_REASONS[i % REFUND_REASONS.length],
            status: refStatus,
            gateway_reference: refStatus !== "pending" ? `mp_refund_bulk_${idx}` : undefined,
            created_at: daysAgo(status === "refunded" ? daysBack - 1 : daysBack),
          },
        })

        await prisma.refundStatusHistory.create({
          data: {
            refund_id: refund.id,
            from_status: refStatus === "approved" ? "pending" : refStatus === "failed" ? "pending" : null,
            to_status: refStatus,
            changed_by: "system",
            reason: refStatus === "approved" ? "refund_processed" : refStatus === "failed" ? "refund_failed" : "pending",
            created_at: daysAgo(status === "refunded" ? daysBack - 1 : daysBack),
          },
        })
        bulkRefundCount++
      }
    }

    // webhook events (one per payment)
    if (status === "approved" || status === "rejected" || status === "refunded") {
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: `mp_evt_bulk_${idx}`,
          event_type: `payment.${status === "refunded" ? "refunded" : status === "rejected" ? "rejected" : "approved"}`,
          payload: { action: `payment.${status}`, data: { id: payment.id } },
          signature_valid: status !== "rejected",
          status: "processed",
          processed_at: daysAgo(daysBack - 1),
          created_at: daysAgo(daysBack),
        },
      })
      bulkWebhookCount++
    }

    // idempotency key for approved payments
    if (status === "approved") {
      await prisma.idempotencyKey.create({
        data: {
          key: `idemp_bulk_${idx}`,
          response: { id: payment.id, status: "approved" },
          status: 200,
          expires_at: daysAgo(-30),
          created_at: daysAgo(daysBack),
        },
      })
      bulkIdempotentCount++
    }
  }

  // ─── Additional webhook events (edge cases) ───
  await prisma.mpWebhookEvent.create({
    data: {
      mp_event_id: "mp_evt_bulk_pending",
      event_type: "payment.pending",
      payload: { action: "payment.created", data: { id: "pay_bulk_001" } },
      signature_valid: true,
      status: "received",
      created_at: daysAgo(2),
    },
  })

  await prisma.mpWebhookEvent.create({
    data: {
      mp_event_id: "mp_evt_bulk_failed",
      event_type: "merchant_order.created",
      payload: { action: "test", data: {} },
      signature_valid: false,
      status: "failed",
      last_error: "HMAC signature mismatch",
      created_at: hoursAgo(6),
    },
  })

  console.log("Seed complete!")
  const counts = {
    payments: await prisma.payment.count(),
    receipts: await prisma.receipt.count(),
    settlements: await prisma.settlement.count(),
    payouts: await prisma.payout.count(),
    refunds: await prisma.refund.count(),
    webhooks: await prisma.mpWebhookEvent.count(),
    idempotency: await prisma.idempotencyKey.count(),
  }
  console.log(
    `  Payments: ${counts.payments}`,
  )
  console.log(`  Settlements: ${counts.settlements}`)
  console.log(`  Payouts: ${counts.payouts}`)
  console.log(`  Refunds: ${counts.refunds}`)
  console.log(`  Receipts: ${counts.receipts}`)
  console.log(`  Webhook events: ${counts.webhooks}`)
  console.log(`  Idempotency keys: ${counts.idempotency}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
