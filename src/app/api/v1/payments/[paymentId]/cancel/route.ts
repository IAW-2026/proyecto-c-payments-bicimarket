import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'

// POST /api/v1/payments/{paymentId}/cancel - Cancel a pending payment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const body = await req.json().catch(() => ({}))

    // Get current payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId }
    })

    if (!payment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Payment not found', details: { paymentId } } },
        { status: 404 }
      )
    }

    // Can only cancel if pending
    if (payment.status !== 'pending') {
      return NextResponse.json(
        {
          error: {
            code: 'CONFLICT',
            message: `Cannot cancel payment in ${payment.status} status. Only pending payments can be cancelled.`,
            details: { current_status: payment.status }
          }
        },
        { status: 409 }
      )
    }

    // Update to cancelled
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'cancelled',
        updated_at: new Date()
      }
    })

    // Create status history entry
    await prisma.paymentStatusHistory.create({
      data: {
        payment_id: paymentId,
        from_status: 'pending',
        to_status: 'cancelled',
        changed_by: 'system',
        reason: body.reason || 'Manual cancellation'
      }
    })

    return NextResponse.json({ data: updatedPayment }, { status: 200 })
  } catch (err) {
    console.error('Error cancelling payment:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel payment' } },
      { status: 500 }
    )
  }
}
