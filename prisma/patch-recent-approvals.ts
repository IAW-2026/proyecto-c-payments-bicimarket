import { PrismaClient } from '../src/generated/prisma/client'

const prisma = new PrismaClient()

async function main() {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const payments = await prisma.payment.findMany({
    where: {
      created_at: { gte: thirtyDaysAgo },
      status: { not: 'approved' },
    },
    include: {
      payment_attempts: true,
      receipts: true,
      settlements: true,
    },
  })

  console.log(`Found ${payments.length} non-approved payments in the last 30 days`)

  for (const payment of payments) {
    const now = new Date()
    const approvedAt = new Date(payment.created_at.getTime() + 86400000)

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'approved',
        approved_at: approvedAt,
        rejected_at: null,
        cancelled_at: null,
      },
    })

    // Create status history
    await prisma.paymentStatusHistory.create({
      data: {
        payment_id: payment.id,
        from_status: payment.status as any,
        to_status: 'approved',
        changed_by: 'system',
        reason: 'payment_approved_via_admin_patch',
        created_at: now,
      },
    })

    // Create attempt if missing
    if (payment.payment_attempts.length === 0) {
      await prisma.paymentAttempt.create({
        data: {
          payment_id: payment.id,
          attempt_number: 1,
          provider: 'mercadopago',
          status: 'approved',
          request_payload: { items: [{ title: `Order ${payment.order_id}`, quantity: 1, unit_price: payment.amount_cents / 100 }] },
          response_payload: { status: 'approved', status_detail: 'accredited' },
          created_at: approvedAt,
        },
      })
    }

    // Create receipt if missing
    if (payment.receipts.length === 0) {
      const rcpNum = String(100000 + Math.floor(Math.random() * 900000)).slice(0, 5)
      await prisma.receipt.create({
        data: {
          payment_id: payment.id,
          receipt_number: `RCP-${rcpNum}`,
          receipt_url: `https://api.bicimarket.ar/receipts/${rcpNum}`,
          amount_cents: payment.amount_cents,
          issued_at: approvedAt,
          created_at: approvedAt,
        },
      })
    }

    // Create settlement if missing
    if (payment.settlements.length === 0) {
      const gross = payment.amount_cents
      const fee = Math.round(gross * 0.15)
      const net = gross - fee
      await prisma.settlement.create({
        data: {
          payment_id: payment.id,
          order_id: payment.order_id,
          order_seller_group_id: `osg_${payment.order_id}_${payment.buyer_profile_id}`,
          sales_order_id: `sor_${payment.buyer_profile_id}_${payment.order_id}`,
          seller_profile_id: payment.buyer_profile_id,
          shipment_id: `shp_${payment.order_id}_${payment.buyer_profile_id}`,
          delivered_at: new Date(approvedAt.getTime() + 4 * 86400000),
          gross_amount_cents: gross,
          fee_amount_cents: fee,
          net_amount_cents: net,
          status: 'paid',
          paid_at: new Date(approvedAt.getTime() + 2 * 86400000),
          created_at: approvedAt,
        },
      })
    }

    console.log(`  ✓ ${payment.id}: ${payment.status} → approved`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
