import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractIdempotencyKey, findByIdempotencyKey } from '@/lib/idempotency'
import { validateServiceTokenBuyer } from '@/lib/service-token'

// GET /api/v1/payments - list payments with filters
// Query params: orderId, buyerId, status, from, to, page (default 1), limit (default 20)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const orderId = url.searchParams.get('orderId')
    const buyerId = url.searchParams.get('buyerId')
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)

    const where: any = {}
    if (orderId) where.order_id = orderId
    if (buyerId) where.buyer_profile_id = buyerId
    if (status) where.status = status
    if (from || to) {
      where.created_at = {}
      if (from) where.created_at.gte = new Date(from)
      if (to) where.created_at.lte = new Date(to)
    }

    const skip = (page - 1) * limit

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        take: limit,
        skip,
        orderBy: { created_at: 'desc' },
        include: { refunds: true }
      }),
      prisma.payment.count({ where })
    ])

    return NextResponse.json({
      data: payments,
      pagination: {
        page,
        limit,
        total,
        has_more: skip + limit < total
      }
    })
  } catch (err) {
    console.error('Error listing payments:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list payments' } }, { status: 500 })
  }
}

// POST /api/v1/payments - create payment (from Buyer App)
export async function POST(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenBuyer(svcToken)) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid service token' } }, { status: 401 })
    }

    const idempotencyKey = extractIdempotencyKey(req)
    if (idempotencyKey) {
      const existing = await findByIdempotencyKey(idempotencyKey)
      if (existing) return NextResponse.json({ data: existing }, { status: 200 })
    }

    const body = await req.json()
    // Basic payload expectation per spec: { order_id, buyer_clerk_user_id, buyer_profile_id, amount_cents, items_summary, ... }
    if (!body?.order_id || !body?.amount_cents || !body?.buyer_profile_id || !body?.buyer_clerk_user_id) {
      return NextResponse.json({ error: { code: 'INVALID_PAYLOAD', message: 'order_id, amount_cents, buyer_profile_id, and buyer_clerk_user_id required' } }, { status: 400 })
    }

    // Validate items_summary if provided
    if (body.items_summary && Array.isArray(body.items_summary)) {
      const summedAmount = body.items_summary.reduce((sum: number, item: any) => {
        return sum + (item.subtotal_cents || 0) + (item.shipping_cost_cents || 0)
      }, 0)
      
      if (summedAmount !== body.amount_cents) {
        return NextResponse.json({
          error: {
            code: 'INVALID_PAYLOAD',
            message: `items_summary total (${summedAmount}) does not match amount_cents (${body.amount_cents})`,
            details: { expected: body.amount_cents, received: summedAmount }
          }
        }, { status: 400 })
      }
    }

    const payment = await prisma.payment.create({ data: {
      order_id: body.order_id,
      buyer_clerk_user_id: body.buyer_clerk_user_id,
      buyer_profile_id: body.buyer_profile_id,
      amount_cents: body.amount_cents,
      currency: body.currency || 'ARS',
      idempotency_key: idempotencyKey,
      status: 'pending'
    }})

    // TODO: Create MercadoPago checkout preference
    // const pref = await createCheckoutPreference({ amount: payment.amount_cents, external_reference: payment.order_id })
    // await prisma.payment.update({ where: { id: payment.id }, data: { gateway_reference: pref.id } })

    // Return payment + checkout url so Buyer App can redirect user
    return NextResponse.json({ data: { ...payment } }, { status: 201 })
  } catch (err) {
    console.error('Error creating payment:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create payment' } }, { status: 500 })
  }
}
