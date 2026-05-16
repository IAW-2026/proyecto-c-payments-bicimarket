import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractIdempotencyKey, findByIdempotencyKey } from '@/lib/idempotency'
import { validateServiceTokenBuyer } from '@/lib/service-token'
import { createCheckoutPreference } from '@/services/mercado-pago.service'
import { handleRouteError, badRequest, unauthorized, notFound } from '@/lib/errors'

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
    const sortBy = url.searchParams.get('sort') || '-created_at'

    const where: Record<string, unknown> = {}
    if (orderId) where.order_id = orderId
    if (buyerId) where.buyer_profile_id = buyerId
    if (status) where.status = status
    if (from || to) {
      where.created_at = {} as Record<string, Date>
      if (from) (where.created_at as Record<string, Date>).gte = new Date(from)
      if (to) (where.created_at as Record<string, Date>).lte = new Date(to)
    }

    const skip = (page - 1) * limit

    const sortField = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
    const sortDir = sortBy.startsWith('-') ? 'desc' as const : 'asc' as const

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: where as any,
        take: limit,
        skip,
        orderBy: { [sortField]: sortDir } as any,
        include: { refunds: true },
      }),
      prisma.payment.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: payments,
      pagination: { page, limit, total, has_more: skip + limit < total, next_cursor: null },
    })
  } catch (err) {
    return handleRouteError(err, 'listing payments')
  }
}

export async function POST(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenBuyer(svcToken)) {
      return unauthorized('Invalid service token')
    }

    const idempotencyKey = extractIdempotencyKey(req)
    if (idempotencyKey) {
      const existing = await findByIdempotencyKey(idempotencyKey)
      if (existing) return NextResponse.json({ data: existing }, { status: 200 })
    }

    const body = await req.json()
    if (!body?.order_id || !body?.amount_cents || !body?.buyer_profile_id || !body?.buyer_clerk_user_id) {
      return badRequest('order_id, amount_cents, buyer_profile_id, and buyer_clerk_user_id required')
    }

    if (body.items_summary && Array.isArray(body.items_summary)) {
      const summedAmount = body.items_summary.reduce((sum: number, item: any) => {
        return sum + (item.subtotal_cents || 0) + (item.shipping_cost_cents || 0)
      }, 0)

      if (summedAmount !== body.amount_cents) {
        return badRequest(`items_summary total (${summedAmount}) does not match amount_cents (${body.amount_cents})`, {
          expected: body.amount_cents,
          received: summedAmount,
        })
      }
    }

    const payment = await prisma.payment.create({
      data: {
        order_id: body.order_id,
        buyer_clerk_user_id: body.buyer_clerk_user_id,
        buyer_profile_id: body.buyer_profile_id,
        amount_cents: body.amount_cents,
        currency: body.currency || 'ARS',
        idempotency_key: idempotencyKey,
        items_summary: body.items_summary || null,
        status: 'pending',
      },
    })

    let checkoutUrl: string | null = null
    let gatewayReference: string | null = null

    try {
      const pref = await createCheckoutPreference({
        amount_cents: payment.amount_cents,
        external_reference: payment.order_id,
        buyer_email: body.buyer_email,
        items: body.items_summary?.map((item: any) => ({
          title: `Seller ${item.seller_profile_id}`,
          quantity: 1,
          unit_price_cents: item.subtotal_cents + item.shipping_cost_cents,
        })) || [],
        return_urls: body.return_urls,
      })

      checkoutUrl = pref.init_point
      gatewayReference = pref.id

      await prisma.payment.update({
        where: { id: payment.id },
        data: { gateway_reference: gatewayReference },
      })
    } catch (mpErr) {
      console.error('Failed to create MP checkout preference:', mpErr)
    }

    return NextResponse.json({
      data: {
        ...payment,
        checkout_url: checkoutUrl,
        gateway_reference: gatewayReference,
      },
    }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'creating payment')
  }
}
