import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenShipping } from '@/lib/service-token'

// POST /api/v1/internal/shipment-delivered - Shipping notifies Payments of delivery (triggers settlement)
export async function POST(req: Request) {
  try {
    // Validate X-Service-Token (from Shipping app)
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenShipping(svcToken)) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing service token' } },
        { status: 401 }
      )
    }

    const body = await req.json()

    // Validate required fields per spec
    const requiredFields = ['shipment_id', 'order_id', 'order_seller_group_id', 'sales_order_id', 'seller_profile_id', 'delivered_at']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: { code: 'INVALID_PAYLOAD', message: `Missing required field: ${field}` } },
          { status: 400 }
        )
      }
    }

    const { shipment_id, order_id, order_seller_group_id, sales_order_id, seller_profile_id, delivered_at } = body

    // Find the payment by order_id
    const payment = await prisma.payment.findFirst({
      where: { order_id }
    })

    if (!payment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Payment not found for order', details: { order_id } } },
        { status: 404 }
      )
    }

    // Check if settlement already exists for this seller
    const existingSettlement = await prisma.settlement.findFirst({
      where: {
        payment_id: payment.id,
        seller_profile_id
      }
    })

    let settlement

    if (existingSettlement) {
      // Update existing settlement to mark as paid (delivered)
      settlement = await prisma.settlement.update({
        where: { id: existingSettlement.id },
        data: {
          status: 'paid',
          paid_at: new Date(delivered_at)
        }
      })

      // Create status history
      await prisma.settlementStatusHistory.create({
        data: {
          settlement_id: settlement.id,
          from_status: existingSettlement.status as any,
          to_status: 'paid',
          changed_by: 'system',
          reason: 'Shipment delivered'
        }
      })
    } else {
      // Create new settlement - should have been created earlier when payment was approved
      // But create it here if missing
      settlement = await prisma.settlement.create({
        data: {
          payment_id: payment.id,
          order_id,
          order_seller_group_id,
          seller_profile_id,
          gross_amount_cents: payment.amount_cents, // Placeholder - should be calculated properly
          fee_amount_cents: Math.round((10 / 100) * payment.amount_cents),
          net_amount_cents: Math.round(payment.amount_cents * 0.9),
          currency: payment.currency,
          status: 'paid',
          paid_at: new Date(delivered_at)
        }
      })

      // Create initial status history
      await prisma.settlementStatusHistory.create({
        data: {
          settlement_id: settlement.id,
          to_status: 'paid',
          changed_by: 'system',
          reason: 'Settlement created on shipment delivery'
        }
      })
    }

    // Log outbound call to Seller app (would be executed async in production)
    await prisma.outboundCallLog.create({
      data: {
        target_app: 'seller',
        method: 'PATCH',
        path: `/api/v1/sales-orders/${sales_order_id}/payment-status`,
        request_body: {
          payment_status: 'settled',
          settlement_id: settlement.id,
          occurred_at: delivered_at
        },
        attempts: 0
      }
    })

    return NextResponse.json(
      { received: true, settlement_id: settlement.id },
      { status: 200 }
    )
  } catch (err) {
    console.error('Error processing shipment delivered:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to process shipment delivery' } },
      { status: 500 }
    )
  }
}
