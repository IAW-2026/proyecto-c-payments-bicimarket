import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { extractIdempotencyKey, findByIdempotencyKey, checkIdempotency, cacheIdempotencyResponse } from '@/lib/idempotency'
import { validateServiceTokenBuyer } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, badRequest } from '@/lib/errors'
import { createPaymentSchema } from '@/schemas/payment'
import mpService from '@/services/mercado-pago.service'

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
  const requestId = crypto.randomUUID?.() || `req_${Date.now()}`
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenBuyer(svcToken)) {
      const adminErr = await requireAdmin()
      if (adminErr) return adminErr
    }

    const idempotencyKey = extractIdempotencyKey(req)
    if (idempotencyKey) {
      const existing = await findByIdempotencyKey(idempotencyKey)
      if (existing) {
        console.info(`[Payments:${requestId}] Idempotency hit (payment): ${idempotencyKey}`)
        return NextResponse.json({ data: existing }, { status: 200 })
      }

      const idempotent = await checkIdempotency(idempotencyKey)
      if (idempotent.cached) {
        console.info(`[Payments:${requestId}] Idempotency hit (cache): ${idempotencyKey}`)
        return idempotent.response
      }
    }

    const body = await req.json()

    const parsed = createPaymentSchema.safeParse(body)
    if (!parsed.success) {
      console.warn(`[Payments:${requestId}] Validation failed:`, parsed.error.issues)
      return badRequest('Validation failed', {
        errors: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      })
    }

    const validated = parsed.data

    if (validated.items_summary) {
      const summedAmount = validated.items_summary.reduce((sum, item) => {
        return sum + item.subtotal_cents + item.shipping_cost_cents
      }, 0)

      if (summedAmount !== validated.amount_cents) {
        return badRequest(`items_summary total (${summedAmount}) does not match amount_cents (${validated.amount_cents})`, {
          expected: validated.amount_cents,
          received: summedAmount,
        })
      }
    }

    console.info(`[Payments:${requestId}] Creating payment: order=${validated.order_id} amount=${validated.amount_cents}`)

    const payment = await prisma.payment.create({
      data: {
        order_id: validated.order_id,
        buyer_clerk_user_id: validated.buyer_clerk_user_id,
        buyer_profile_id: validated.buyer_profile_id,
        amount_cents: validated.amount_cents,
        currency: validated.currency || 'ARS',
        idempotency_key: idempotencyKey,
        items_summary: validated.items_summary ?? undefined,
        status: 'pending',
      },
    })

    console.info(`[Payments:${requestId}] Payment created: ${payment.id}`)

    // Build Mercado Pago preference
    const items: any[] = []
    if (validated.items_summary && validated.items_summary.length > 0) {
      for (const seller of validated.items_summary) {
        if (Array.isArray((seller as any).items) && (seller as any).items.length > 0) {
          for (const it of (seller as any).items) {
            items.push({
              title: it.product_name_snapshot,
              quantity: it.quantity,
              unit_price: (it.unit_price_cents || 0) / 100,
              currency_id: validated.currency,
            })
          }
        }
      }
    }

    if (items.length === 0) {
      // Fallback to a single item representing the order
      items.push({ title: `Order ${validated.order_id}`, quantity: 1, unit_price: validated.amount_cents / 100, currency_id: validated.currency })
    }

    const preference: Record<string, unknown> = {
      items,
      payer: validated.buyer_email ? { email: validated.buyer_email } : undefined,
      external_reference: payment.id,
      auto_return: 'approved',
      back_urls: validated.return_urls ?? undefined,
    }

    try {
      const mpResp = await mpService.createPreference(preference)
      const body = (mpResp && (mpResp.body || mpResp)) as any

      // Record the outbound attempt with raw request/response for auditing
      await prisma.paymentAttempt.create({
        data: {
          payment_id: payment.id,
          attempt_number: 1,
          provider: 'mercadopago',
          status: 'pending',
          request_payload: preference as any,
          response_payload: body as any,
        },
      })

      const responseBody = {
        data: { payment_id: payment.id, init_point: body.init_point || body.sandbox_init_point, preference_id: body.id },
        public_key: mpService.getPublicKey?.(),
      }

      if (idempotencyKey) {
        await cacheIdempotencyResponse(idempotencyKey, responseBody, 200)
      }

      return NextResponse.json(responseBody)
    } catch (mpErr) {
      console.error(`[Payments:${requestId}] Mercado Pago preference creation failed:`, mpErr)
      // record failed attempt
      await prisma.paymentAttempt.create({
        data: {
          payment_id: payment.id,
          attempt_number: 1,
          provider: 'mercadopago',
          status: 'rejected',
          request_payload: preference as any,
          response_payload: (mpErr && (mpErr)) as any,
        },
      })
      return NextResponse.json({ error: 'failed to create payment preference' }, { status: 502 })
    }

  } catch (err) {
    return handleRouteError(err, 'creating payment')
  }
}
