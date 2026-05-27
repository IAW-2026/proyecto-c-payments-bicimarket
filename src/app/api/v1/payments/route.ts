import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractIdempotencyKey, findByIdempotencyKey, checkIdempotency, cacheIdempotencyResponse } from '@/lib/idempotency'
import { validateServiceTokenBuyer } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { createCheckoutPreference, MercadoPagoError, MercadoPagoCredentialError } from '@/services/mercado-pago.service'
import { handleRouteError, badRequest, unauthorized } from '@/lib/errors'
import { createPaymentSchema } from '@/schemas/payment'

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

    let checkoutUrl: string | null = null
    let gatewayReference: string | null = null
    let preferenceWarning: string | null = null

    try {
      const pref = await createCheckoutPreference({
        amount_cents: payment.amount_cents,
        external_reference: payment.id,
        buyer_email: validated.buyer_email,
        items: validated.items_summary?.map((item) => ({
          title: `Seller ${item.seller_profile_id}`,
          quantity: 1,
          unit_price_cents: item.subtotal_cents + item.shipping_cost_cents,
        })) || [],
        return_urls: validated.return_urls,
      })

      checkoutUrl = pref.init_point
      gatewayReference = pref.id

      await prisma.payment.update({
        where: { id: payment.id },
        data: { gateway_reference: gatewayReference },
      })

      console.info(`[Payments:${requestId}] MP preference created: ${gatewayReference} | checkout_url set: ${!!checkoutUrl} | sandbox=${pref.sandbox_mode}`)

      // Validate the checkout URL is well-formed
      if (!checkoutUrl || !checkoutUrl.startsWith('https://')) {
        console.error(`[Payments:${requestId}] Checkout URL is invalid: ${checkoutUrl}`)
        preferenceWarning = 'MP returned an invalid checkout URL'
        checkoutUrl = null
      }
    } catch (mpErr) {
      if (mpErr instanceof MercadoPagoCredentialError) {
        console.error(`[Payments:${requestId}] MP CREDENTIAL ERROR:`, {
          message: mpErr.message,
          mpCode: mpErr.mpCode,
          statusCode: mpErr.statusCode,
        })
        preferenceWarning = `MP credential error: ${mpErr.message}`
      } else if (mpErr instanceof MercadoPagoError) {
        console.error(`[Payments:${requestId}] MP preference creation failed:`, {
          statusCode: mpErr.statusCode,
          mpCode: mpErr.mpCode,
          message: mpErr.message,
        })
        preferenceWarning = `MP error: ${mpErr.message}`
      } else {
        console.error(`[Payments:${requestId}] Failed to create MP checkout preference:`, mpErr)
        preferenceWarning = 'Failed to create MP checkout preference'
      }
    }

    if (!checkoutUrl) {
      console.warn(`[Payments:${requestId}] Payment ${payment.id} created WITHOUT checkout_url: ${preferenceWarning || 'unknown reason'}`)
    }

    const responseBody = {
      data: {
        ...payment,
        checkout_url: checkoutUrl,
        gateway_reference: gatewayReference,
        preference_warning: preferenceWarning,
      },
    }

    if (idempotencyKey) {
      await cacheIdempotencyResponse(idempotencyKey, responseBody, 201)
    }

    return NextResponse.json(responseBody, { status: 201 })
  } catch (err) {
    console.error(`[Payments:${requestId}] Fatal error:`, err)
    return handleRouteError(err, 'creating payment')
  }
}
