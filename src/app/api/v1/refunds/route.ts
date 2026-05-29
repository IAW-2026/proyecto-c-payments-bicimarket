import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, badRequest, notFound } from '@/lib/errors'
import { extractIdempotencyKey, checkIdempotency, cacheIdempotencyResponse } from '@/lib/idempotency'
import { notifyBuyerOrderStatus } from '@/services/inter-app-client.service'
import mpService from '@/services/mercado-pago.service'

export async function GET(req: Request) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')
    const status = url.searchParams.get('status')
    const reason = url.searchParams.get('reason')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const sortBy = url.searchParams.get('sort') || '-created_at'

    const where: Record<string, unknown> = { deleted_at: null }
    if (paymentId) where.payment_id = paymentId
    if (status) where.status = status
    if (reason) where.reason = reason
    if (from || to) {
      where.created_at = {} as Record<string, Date>
      if (from) (where.created_at as Record<string, Date>).gte = new Date(from)
      if (to) (where.created_at as Record<string, Date>).lte = new Date(to)
    }

    const skip = (page - 1) * limit

    const sortField = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
    const sortDir = sortBy.startsWith('-') ? 'desc' as const : 'asc' as const

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where: where as any,
        take: limit,
        skip,
        orderBy: { [sortField]: sortDir } as any,
        include: {
          payment: { select: { order_id: true, status: true, amount_cents: true } },
          status_history: { orderBy: { created_at: 'desc' }, take: 1 },
        },
      }),
      prisma.refund.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: refunds,
      pagination: { page, limit, total, has_more: skip + limit < total, next_cursor: null },
    })
  } catch (err) {
    return handleRouteError(err, 'listing refunds')
  }
}

export async function POST(req: Request) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const idempotencyKey = extractIdempotencyKey(req)
    if (idempotencyKey) {
      const cached = await checkIdempotency(idempotencyKey)
      if (cached.cached) return cached.response
    }

    const body = await req.json()
    const { payment_id, amount_cents, reason = 'manual', seller_profile_id } = body

    if (!payment_id || !amount_cents || !reason) {
      return badRequest('payment_id, amount_cents, and reason are required')
    }

    const payment = await prisma.payment.findUnique({ where: { id: payment_id } })
    if (!payment) {
      return notFound('Payment not found', { payment_id })
    }

    if (payment.status !== 'approved') {
      return badRequest(`Cannot refund payment in ${payment.status} state`, {
        current_status: payment.status,
      })
    }

    if (amount_cents <= 0 || amount_cents > payment.amount_cents) {
      return badRequest(`Refund amount must be between 0 and ${payment.amount_cents}`, {
        max_amount: payment.amount_cents,
      })
    }

    const refund = await prisma.refund.create({
      data: {
        payment_id,
        amount_cents,
        currency: payment.currency,
        reason: reason as any,
        seller_profile_id: seller_profile_id || null,
        status: 'pending',
      },
      include: {
        payment: { select: { order_id: true, status: true, gateway_reference: true } },
      },
    })

    if (payment.gateway_reference) {
      try {
        const mpResult = await mpService.createRefund(payment.gateway_reference, amount_cents)
        const isApproved = mpResult.status === 'approved'

        await prisma.refund.update({
          where: { id: refund.id },
          data: {
            gateway_reference: mpResult.id,
            status: isApproved ? 'approved' : 'pending',
          },
        })

        if (isApproved) {
          const totalRefunded = await prisma.refund.aggregate({
            where: { payment_id, status: 'approved' },
            _sum: { amount_cents: true },
          })
          const totalRefundedAmount = totalRefunded._sum.amount_cents || amount_cents
          const isFullyRefunded = totalRefundedAmount >= payment.amount_cents

          await prisma.paymentStatusHistory.create({
            data: {
              payment_id,
              from_status: 'approved',
              to_status: isFullyRefunded ? 'refunded' : 'approved',
              changed_by: 'admin',
              reason: `Refund of ${amount_cents} cents processed via MP (${isFullyRefunded ? 'full' : 'partial'})`,
            },
          })

          if (isFullyRefunded) {
            await prisma.payment.update({
              where: { id: payment_id },
              data: { status: 'refunded' },
            })
          }

          try {
            await notifyBuyerOrderStatus(payment.order_id, 'refunded', payment.id)
          } catch (notifyErr) {
            console.error('Failed to notify buyer of refund:', notifyErr)
          }
        }
      } catch (mpErr) {
        console.error('MP refund failed:', mpErr)
        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: 'failed' },
        })
      }
    }

    const finalRefund = await prisma.refund.findUnique({
      where: { id: refund.id },
      include: { payment: { select: { order_id: true, status: true } } },
    })

    const response = { data: finalRefund }
    if (idempotencyKey) {
      await cacheIdempotencyResponse(idempotencyKey, response, 201)
    }

    return NextResponse.json(response, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'creating refund')
  }
}