import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenShipping } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { calculateSettlementAmounts } from '@/services/settlement.service'
import { notifySellerPaymentStatus } from '@/services/inter-app-client.service'
import { handleRouteError, badRequest, notFound, unauthorized } from '@/lib/errors'

export async function POST(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenShipping(svcToken)) {
      const adminErr = await requireAdmin()
      if (adminErr) return unauthorized('Invalid or missing service token', 'SERVICE_TOKEN_INVALID')
    }

    const body = await req.json()
    const requiredFields = ['shipment_id', 'order_id', 'order_seller_group_id', 'sales_order_id', 'seller_profile_id', 'delivered_at']
    for (const field of requiredFields) {
      if (!body[field]) {
        return badRequest('MISSING_REQUIRED_FIELD', `Missing required field: ${field}`)
      }
    }

    const { shipment_id, order_id, order_seller_group_id, sales_order_id, seller_profile_id, delivered_at } = body

    const payment = await prisma.payment.findFirst({ where: { order_id } })
    if (!payment) {
      return notFound('PAYMENT_NOT_FOUND', 'Payment not found for order', { order_id })
    }

    const sellerAmounts = getSellerAmountFromPayment(payment, seller_profile_id)

    let settlement = await prisma.settlement.findFirst({
      where: { payment_id: payment.id, seller_profile_id },
    })

    if (settlement) {
      // Settlement already exists; keep it as pending until payout is processed.
      // Do NOT auto-mark paid — that happens via payout or admin action.
      console.log(`[ShipmentDelivered] Settlement ${settlement.id} already exists (status=${settlement.status}), skipping creation`)
    } else {
      settlement = await prisma.settlement.create({
        data: {
          payment_id: payment.id,
          order_id,
          order_seller_group_id,
          seller_profile_id,
          gross_amount_cents: sellerAmounts.gross,
          fee_amount_cents: sellerAmounts.fee,
          net_amount_cents: sellerAmounts.net,
          currency: payment.currency,
          status: 'pending',
        },
      })
      console.log(`[ShipmentDelivered] Settlement created: ${settlement.id} seller=${seller_profile_id} gross=${sellerAmounts.gross} fee=${sellerAmounts.fee} net=${sellerAmounts.net}`)

      await prisma.settlementStatusHistory.create({
        data: {
          settlement_id: settlement.id,
          to_status: 'pending',
          changed_by: 'system',
          reason: 'Settlement created on shipment delivery',
        },
      })
    }

    console.log(`[ShipmentDelivered] Notifying seller payment status: salesOrder=${sales_order_id} settlement=${settlement.id}`)
    try {
      await notifySellerPaymentStatus(sales_order_id, 'settled', settlement.id)
    } catch (err) {
      console.error('[ShipmentDelivered] notifySellerPaymentStatus failed:', err instanceof Error ? err.message : err)
    }

    return NextResponse.json({ received: true, settlement_id: settlement.id }, { status: 200 })
  } catch (err) {
    return handleRouteError(err, 'processing shipment delivered')
  }
}

function getSellerAmountFromPayment(payment: { amount_cents: number; items_summary: unknown }, sellerProfileId: string): { gross: number; fee: number; net: number } {
  if (!payment.items_summary || !Array.isArray(payment.items_summary)) {
    throw new Error(`Cannot calculate settlement: items_summary missing for payment. seller=${sellerProfileId}`)
  }

  const sellerItem = (payment.items_summary as Array<{
    seller_profile_id: string
    subtotal_cents: number
    shipping_cost_cents: number
  }>).find(item => item.seller_profile_id === sellerProfileId)

  if (!sellerItem) {
    throw new Error(`Cannot calculate settlement: seller ${sellerProfileId} not found in payment items_summary`)
  }

  const gross = sellerItem.subtotal_cents + sellerItem.shipping_cost_cents
  const amounts = calculateSettlementAmounts(gross, 10)
  return amounts
}
