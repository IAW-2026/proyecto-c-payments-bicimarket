import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractIdempotencyKey, findByIdempotencyKey } from '@/lib/idempotency'
import { validateServiceTokenShipping } from '@/lib/service-token'

// GET /api/v1/settlements - list settlements with filters
// Query params: paymentId, sellerId, status, from, to, page (default 1), limit (default 20)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')
    const sellerId = url.searchParams.get('sellerId')
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)

    const where: any = {}
    if (paymentId) where.payment_id = paymentId
    if (sellerId) where.seller_profile_id = sellerId
    if (status) where.status = status
    if (from || to) {
      where.created_at = {}
      if (from) where.created_at.gte = new Date(from)
      if (to) where.created_at.lte = new Date(to)
    }

    const skip = (page - 1) * limit

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where,
        take: limit,
        skip,
        orderBy: { created_at: 'desc' },
        include: { payouts: true }
      }),
      prisma.settlement.count({ where })
    ])

    return NextResponse.json({
      data: settlements,
      pagination: {
        page,
        limit,
        total,
        has_more: skip + limit < total
      }
    })
  } catch (err) {
    console.error('Error listing settlements:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list settlements' } }, { status: 500 })
  }
}

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
    return NextResponse.json({ data: settlement }, { status: 201 })
  } catch (err) {
    console.error('Error creating settlement:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create settlement' } }, { status: 500 })
  }
}
