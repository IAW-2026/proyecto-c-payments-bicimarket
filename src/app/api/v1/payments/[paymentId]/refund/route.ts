import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenSeller } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { extractIdempotencyKey, findByIdempotencyKey, checkIdempotency, cacheIdempotencyResponse } from '@/lib/idempotency'
import { notifyBuyerOrderStatus } from '@/services/inter-app-client.service'
import mpService from '@/services/mercado-pago.service'
import { handleRouteError, badRequest, notFound, unauthorized } from '@/lib/errors'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenSeller(svcToken)) {
      const adminErr = await requireAdmin()
      if (adminErr) return adminErr
    }

    const idempotencyKey = extractIdempotencyKey(req)
    if (idempotencyKey) {
      const cached = await checkIdempotency(idempotencyKey)
      if (cached.cached) return cached.response
    }

    const { paymentId } = await params

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) {
      return notFound('PAYMENT_NOT_FOUND', 'Payment not found', { paymentId })
    }

    if (payment.status !== 'approved') {
      return badRequest('INVALID_PAYMENT_STATE', `Cannot refund payment in ${payment.status} state`, {
        current_status: payment.status,
      })
    }

    const body = await req.json()
    const { amount_cents, reason = 'seller_rejected', seller_profile_id } = body

    if (!amount_cents || amount_cents <= 0 || amount_cents > payment.amount_cents) {
      return badRequest('INVALID_REFUND_AMOUNT', `Refund amount must be between 0 and ${payment.amount_cents}`, {
        max_amount: payment.amount_cents,
      })
    }

    const refund = await prisma.refund.create({
      data: {
        payment_id: paymentId,
        amount_cents,
        currency: payment.currency,
        reason: reason as any,
        seller_profile_id: seller_profile_id || null,
        status: 'pending',
      },
    })

    if (payment.gateway_reference) {
      try {
        const mpResult = await mpService.createRefund(payment.gateway_reference, amount_cents)

        await prisma.refund.update({
          where: { id: refund.id },
          data: {
            gateway_reference: mpResult.id,
            status: mpResult.status === 'approved' ? 'approved' : 'pending',
          },
        })

        if (mpResult.status === 'approved') {
          const totalRefunded = await prisma.refund.aggregate({
            where: { payment_id: paymentId, status: 'approved' },
            _sum: { amount_cents: true },
          })
          const totalRefundedAmount = totalRefunded._sum.amount_cents || amount_cents
          const isFullyRefunded = totalRefundedAmount >= payment.amount_cents

          await prisma.$transaction(async (tx) => {
            if (isFullyRefunded) {
              await tx.payment.update({
                where: { id: paymentId },
                data: { status: 'refunded' },
              })
            }
            await tx.paymentStatusHistory.create({
              data: {
                payment_id: paymentId,
                from_status: 'approved',
                to_status: isFullyRefunded ? 'refunded' : 'approved',
                changed_by: 'system',
                reason: `Refund of ${amount_cents} cents processed via MP (${isFullyRefunded ? 'full' : 'partial'})`,
              },
            })
          })

          // try {
          //   await notifyBuyerOrderStatus(payment.order_id, 'refunded', payment.id)
          // } catch (notifyErr) {
          //   console.error('Failed to notify buyer of refund:', notifyErr)
          // }
        }
      } catch (mpErr) {
        const mpMessage = mpErr instanceof Error ? mpErr.message : (mpErr as any)?.response?.data?.message || String(mpErr)
        console.error('MP refund failed:', mpErr, 'Message:', mpMessage)
        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: 'failed' },
        })
        return badRequest('MP_REFUND_FAILED', `MP refund failed: ${mpMessage}`, {
          gateway_reference: payment.gateway_reference,
          mp_error: mpMessage,
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
    return handleRouteError(err, 'processing refund')
  }
}