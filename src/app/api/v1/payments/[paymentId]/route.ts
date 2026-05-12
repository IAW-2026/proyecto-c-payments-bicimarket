import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/payments/{paymentId} - get payment detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        payment_attempts: true,
        refunds: true,
        settlements: true,
        receipts: true
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: payment }, { status: 200 })
  } catch (err) {
    console.error('Error fetching payment:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment' } },
      { status: 500 }
    )
  }
}
