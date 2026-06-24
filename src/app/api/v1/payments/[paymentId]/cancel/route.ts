import { prisma } from '@/lib/prisma'
import { validatePaymentTransition } from '@/lib/state-machines/payment'
import { validateServiceTokenBuyer } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, notFound, conflict } from '@/lib/errors'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenBuyer(svcToken)) {
      const adminErr = await requireAdmin()
      if (adminErr) return adminErr
    }

    const { paymentId } = await params
    const body = await req.json().catch(() => ({}))

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) {
      return notFound('PAYMENT_NOT_FOUND', 'Payment not found', { paymentId })
    }

    try {
      validatePaymentTransition(payment.status as any, 'cancelled')
    } catch {
      return conflict('INVALID_TRANSITION', `Cannot cancel payment in ${payment.status} status. Only pending payments can be cancelled.`, {
        current_status: payment.status,
      })
    }

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'cancelled', cancelled_at: new Date() },
      })

      await tx.paymentStatusHistory.create({
        data: {
          payment_id: paymentId,
          from_status: payment.status,
          to_status: 'cancelled',
          changed_by: 'system',
          reason: body.reason || 'Manual cancellation',
        },
      })

      return updated
    })

    return new Response(JSON.stringify({ data: updatedPayment }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return handleRouteError(err, 'cancelling payment')
  }
}
