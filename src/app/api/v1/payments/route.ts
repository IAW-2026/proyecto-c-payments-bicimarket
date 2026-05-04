import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractIdempotencyKey, findByIdempotencyKey } from '@/lib/idempotency'
import { validateServiceToken } from '@/lib/service-token'
import { createCheckoutPreference } from '@/services/mercado-pago.service'

// GET /api/v1/payments - list payments (admin)
export async function GET(req: Request) {
  try {
    const payments = await prisma.payment.findMany({ take: 50 })
    return NextResponse.json({ data: payments })
  } catch (err) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list payments' } }, { status: 500 })
  }
}

// POST /api/v1/payments - create payment (from Buyer App)
export async function POST(req: Request) {
  try {
    // Validate X-Service-Token header (skeleton)
    // @ts-ignore
    // const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    // if (!validateServiceToken(svcToken)) {
    //   return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid service token' } }, { status: 401 })
    // }

    const idempotencyKey = extractIdempotencyKey(req)
    if (idempotencyKey) {
      const existing = await findByIdempotencyKey(idempotencyKey)
      if (existing) return NextResponse.json({ data: existing }, { status: 200 })
    }

    const body = await req.json()
    // Basic payload expectation: { order_id, buyer_profile_id, amount_cents, currency }
    if (!body?.order_id || !body?.amount_cents) {
      return NextResponse.json({ error: { code: 'INVALID_PAYLOAD', message: 'order_id and amount_cents required' } }, { status: 400 })
    }

    const payment = await prisma.payment.create({ data: {
      order_id: body.order_id,
      buyer_profile_id: body.buyer_profile_id || '',
      amount_cents: body.amount_cents,
      currency: body.currency || 'ARS',
      idempotency_key: idempotencyKey || undefined
    }})

    // Create MercadoPago checkout preference (mock/skeleton)
    const pref = await createCheckoutPreference({ amount: payment.amount_cents, external_reference: payment.order_id })
    await prisma.payment.update({ where: { id: payment.id }, data: { gateway_reference: pref.id } })

    // Return payment + checkout url so Buyer App can redirect user
    return NextResponse.json({ data: { ...payment, checkout_url: pref.init_point } }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create payment' } }, { status: 500 })
  }
}
