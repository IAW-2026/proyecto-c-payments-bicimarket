import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractIdempotencyKey, findPaymentByKey } from '@/lib/idempotency'
import { validateServiceTokenBuyer, validateServiceTokenAnalytics } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, badRequest, errorResponse } from '@/lib/errors'
import { createPaymentSchema } from '@/schemas/payment'
import mpService from '@/services/mercado-pago.service'

export async function GET(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenAnalytics(svcToken) && !validateServiceTokenBuyer(svcToken)) {
      const adminErr = await requireAdmin()
      if (adminErr) return adminErr
    }

    const url = new URL(req.url)
    const orderId = url.searchParams.get('orderId')
    const buyerId = url.searchParams.get('buyerId')
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')
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
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { order_id: { contains: q, mode: "insensitive" } },
        { buyer_profile_id: { contains: q, mode: "insensitive" } },
        { gateway_reference: { contains: q, mode: "insensitive" } },
      ]
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
    if (!idempotencyKey) {
      return badRequest('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required')
    }

    const existing = await findPaymentByKey(idempotencyKey)
    if (existing) {
      return NextResponse.json({
        data: {
          payment_id: existing.id,
          checkout_url: existing.checkout_url,
          preference_id: existing.preference_id,
        },
        public_key: mpService.getPublicKey?.(),
      }, { status: 200 })
    }

    const body = await req.json()

    const parsed = createPaymentSchema.safeParse(body)
    if (!parsed.success) {
      console.warn(`[Payments:${requestId}] Validation failed:`, parsed.error.issues)
      return badRequest('VALIDATION_FAILED', 'Validation failed', {
        errors: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      })
    }

    const validated = parsed.data

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
        if ((seller as any).shipping_cost_cents && (seller as any).shipping_cost_cents > 0) {
          items.push({
            title: 'Envío',
            quantity: 1,
            unit_price: (seller as any).shipping_cost_cents / 100,
            currency_id: validated.currency,
          })
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
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL ? `${process.env.MERCADOPAGO_WEBHOOK_URL}?source_news=webhooks` : undefined,
    }

    try {
      const mpResp = await mpService.createPreference(preference)
      const body = (mpResp && (mpResp as any).body || mpResp) as any

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

      const checkout_url = body.init_point || body.sandbox_init_point
      const preference_id = body.id

      await prisma.payment.update({
        where: { id: payment.id },
        data: { checkout_url, preference_id },
      })

      return NextResponse.json({
        data: { payment_id: payment.id, checkout_url, preference_id },
        public_key: mpService.getPublicKey?.(),
      }, { status: 201 })
    } catch (mpErr) {
      const mpMessage = mpErr instanceof Error ? mpErr.message : (mpErr as any)?.response?.data?.message || String(mpErr)
      console.error(`[Payments:${requestId}] MP preference failed for payment ${payment.id}: ${mpMessage}`)
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
      return errorResponse('MP_PREFERENCE_FAILED', 'Failed to create Mercado Pago payment preference', 502)
    }

  } catch (err) {
    return handleRouteError(err, 'creating payment')
  }
}
