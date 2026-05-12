import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma'

// PATCH /api/v1/payments/{paymentId}/confirm - Admin override to confirm/reject payment
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    const body = await req.json()

    // Validate request
    if (!body?.status || !['approved', 'rejected'].includes(body.status)) {
      return NextResponse.json(
        { error: { code: 'INVALID_PAYLOAD', message: 'status must be "approved" or "rejected"' } },
        { status: 400 }
      )
    }

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

    const newStatus = body.status === 'approved' ? 'approved' : 'rejected'

    // Update payment status
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: newStatus as any,
        gateway_reference: body.gateway_reference || payment.gateway_reference,
        approved_at: newStatus === 'approved' ? new Date() : payment.approved_at,
        rejected_at: newStatus === 'rejected' ? new Date() : payment.rejected_at,
        updated_at: new Date()
      }
    })

    // Create status history entry
    await prisma.paymentStatusHistory.create({
      data: {
        payment_id: paymentId,
        from_status: payment.status as any,
        to_status: newStatus as any,
        changed_by: 'admin',
        reason: body.reason || 'Admin override confirmation'
      }
    })

    return NextResponse.json({ data: updatedPayment }, { status: 200 })
  } catch (err) {
    console.error('Error confirming payment:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to confirm payment' } },
      { status: 500 }
    )
  }
}
