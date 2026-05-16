import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenShipping } from '@/lib/service-token'
import { calculateSettlementAmounts } from '@/services/settlement.service'
import { notifySellerPaymentStatus } from '@/services/inter-app-client.service'
import { handleRouteError, badRequest, notFound, unauthorized } from '@/lib/errors'
import { validateSettlementTransition } from '@/lib/state-machines/settlement'

export async function POST(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenShipping(svcToken)) {
      return unauthorized('Invalid or missing service token')
    }

    const body = await req.json()
    const requiredFields = ['shipment_id', 'order_id', 'order_seller_group_id', 'sales_order_id', 'seller_profile_id', 'delivered_at']
    for (const field of requiredFields) {
      if (!body[field]) {
        return badRequest(`Missing required field: ${field}`)
      }
    }

    const { shipment_id, order_id, order_seller_group_id, sales_order_id, seller_profile_id, delivered_at } = body

    const payment = await prisma.payment.findFirst({ where: { order_id } })
    if (!payment) {
      return notFound('Payment not found for order', { order_id })
    }

    const sellerAmounts = getSellerAmountFromPayment(payment, seller_profile_id)

    let settlement = await prisma.settlement.findFirst({
      where: { payment_id: payment.id, seller_profile_id },
    })

    if (settlement) {
      validateSettlementTransition(settlement.status, 'paid')

      settlement = await prisma.$transaction(async (tx) => {
        const updated = await tx.settlement.update({
          where: { id: settlement!.id },
          data: { status: 'paid', paid_at: new Date(delivered_at) },
        })

        await tx.settlementStatusHistory.create({
          data: {
            settlement_id: updated.id,
            from_status: settlement!.status,
            to_status: 'paid',
            changed_by: 'system',
            reason: 'Shipment delivered',
          },
        })

        return updated
      })
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

      await prisma.settlementStatusHistory.create({
        data: {
          settlement_id: settlement.id,
          to_status: 'pending',
          changed_by: 'system',
          reason: 'Settlement created on shipment delivery',
        },
      })
    }

    try {
      await notifySellerPaymentStatus(sales_order_id, 'paid', settlement.id)
    } catch (err) {
      console.error('Failed to notify seller of payment status:', err)
    }

    return NextResponse.json({ received: true, settlement_id: settlement.id }, { status: 200 })
  } catch (err) {
    return handleRouteError(err, 'processing shipment delivered')
  }
}

function getSellerAmountFromPayment(payment: { amount_cents: number; items_summary: unknown }, sellerProfileId: string): { gross: number; fee: number; net: number } {
  if (payment.items_summary && Array.isArray(payment.items_summary)) {
    const sellerItem = (payment.items_summary as Array<{
      seller_profile_id: string
      subtotal_cents: number
      shipping_cost_cents: number
    }>).find(item => item.seller_profile_id === sellerProfileId)

    if (sellerItem) {
      const gross = sellerItem.subtotal_cents + sellerItem.shipping_cost_cents
      const amounts = calculateSettlementAmounts(gross, 10)
      return amounts
    }
  }

  const singleSellerGross = Math.round(payment.amount_cents / 2)
  const amounts = calculateSettlementAmounts(singleSellerGross, 10)
  console.warn(`No items_summary for seller ${sellerProfileId}, using estimated amount ${singleSellerGross}`)
  return amounts
}
