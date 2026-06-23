import { NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenShipping } from '@/lib/service-token'
import { calculateSettlementAmounts } from '@/services/settlement.service'
import { handleRouteError, badRequest, notFound, unauthorized } from '@/lib/errors'
import { shipmentDeliveredSchema } from '@/schemas/payment'

export async function POST(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenShipping(svcToken)) {
      return unauthorized('Invalid or missing service token', 'SERVICE_TOKEN_INVALID')
    }

    const body = await req.json()
    const parsed = shipmentDeliveredSchema.safeParse(body)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return badRequest('VALIDATION_ERROR', firstIssue.message)
    }

    const { shipment_id, order_id, order_seller_group_id, sales_order_id, seller_profile_id, delivered_at } = parsed.data

    const payment = await prisma.payment.findFirst({
      where: { order_id, status: 'approved' },
    })
    if (!payment) {
      return notFound('PAYMENT_NOT_FOUND', 'No approved payment found for order', { order_id })
    }

    const sellerAmounts = getSellerAmountFromPayment(payment, seller_profile_id)
    const deliveredAtDate = new Date(delivered_at)

    let settlement

    try {
      await prisma.$transaction(async (tx) => {
        settlement = await tx.settlement.create({
          data: {
            payment_id: payment.id,
            order_id,
            order_seller_group_id,
            sales_order_id,
            seller_profile_id,
            shipment_id,
            delivered_at: deliveredAtDate,
            gross_amount_cents: sellerAmounts.gross,
            fee_amount_cents: sellerAmounts.fee,
            net_amount_cents: sellerAmounts.net,
            currency: payment.currency,
            status: 'pending',
          },
        })
        await tx.settlementStatusHistory.create({
          data: {
            settlement_id: settlement.id,
            to_status: 'pending',
            changed_by: 'system',
            reason: 'Settlement created on shipment delivery',
          },
        })
      })
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        settlement = await prisma.settlement.findFirst({
          where: { payment_id: payment.id, seller_profile_id },
        })
        if (!settlement) throw err
      } else {
        throw err
      }
    }

    if (!settlement) {
      throw new Error('Settlement could not be created or found')
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
