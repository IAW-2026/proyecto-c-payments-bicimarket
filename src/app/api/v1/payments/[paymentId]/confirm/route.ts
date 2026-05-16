import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { validatePaymentTransition } from '@/lib/state-machines/payment'
import { handleRouteError, badRequest, notFound } from '@/lib/errors'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const { paymentId } = await params
    const body = await req.json()

    if (!body?.status || !['approved', 'rejected'].includes(body.status)) {
      return badRequest('status must be "approved" or "rejected"')
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) {
      return notFound('Payment not found', { paymentId })
    }

    const newStatus = body.status as 'approved' | 'rejected'
    validatePaymentTransition(payment.status as any, newStatus)

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: newStatus,
          gateway_reference: body.gateway_reference || payment.gateway_reference,
          approved_at: newStatus === 'approved' ? new Date() : payment.approved_at,
          rejected_at: newStatus === 'rejected' ? new Date() : payment.rejected_at,
        },
      })

      await tx.paymentStatusHistory.create({
        data: {
          payment_id: paymentId,
          from_status: payment.status,
          to_status: newStatus,
          changed_by: 'system',
          reason: body.reason || 'Admin override confirmation',
        },
      })

      return updated
    })

    return NextResponse.json({ data: updatedPayment }, { status: 200 })
  } catch (err) {
    return handleRouteError(err, 'confirming payment')
  }
}
