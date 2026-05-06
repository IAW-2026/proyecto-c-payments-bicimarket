import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractIdempotencyKey, findByIdempotencyKey } from '@/lib/idempotency'
import { validateServiceTokenShipping } from '@/lib/service-token'
import { createCheckoutPreference } from '@/services/mercado-pago.service'

// POST /api/v1/settlements - create settlement (from Shipping App)
export async function POST(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenShipping(svcToken)) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid service token' } }, { status: 401 })
    }

    const body = await req.json()
    // Basic payload expectation: { order_id, order_seller_group_id, seller_profile_id, payment_id, gross_amount_cents, fee_amount_cents, net_amount_cents, currency }
    if (!body?.order_id || !body?.order_seller_group_id || !body?.seller_profile_id || !body?.payment_id || !body?.gross_amount_cents || !body?.fee_amount_cents || !body?.net_amount_cents || !body?.currency) {
      return NextResponse.json({ error: { code: 'INVALID_PAYLOAD', message: 'All fields required' } }, { status: 400 })
    }

    const settlement = await prisma.settlement.create({ data: {
      payment_id: body.payment_id,
      order_id: body.order_id,
      order_seller_group_id: body.order_seller_group_id,
      seller_profile_id: body.seller_profile_id,
      gross_amount_cents: body.gross_amount_cents,
      fee_amount_cents: body.fee_amount_cents,
      net_amount_cents: body.net_amount_cents,
      currency: body.currency || 'ARS'
    }})

    // Return settlement
    return NextResponse.json({ data: { ...settlement, } }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create settlement' } }, { status: 500 })
  }
}
