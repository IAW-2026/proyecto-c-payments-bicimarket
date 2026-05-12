import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/v1/payments/{paymentId}/refund - process refund
export async function POST(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const { paymentId } = await params
    
    // Get payment
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 }
      )
    }

    // Check if payment is in approved state
    if (payment.status !== 'approved') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: `Cannot refund payment in ${payment.status} state` } },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { amount_cents, reason = 'manual' } = body

    // Validate amount
    if (!amount_cents || amount_cents <= 0 || amount_cents > payment.amount_cents) {
      return NextResponse.json(
        { error: { code: 'INVALID_AMOUNT', message: `Refund amount must be between 0 and ${payment.amount_cents}` } },
        { status: 400 }
      )
    }

    // Check if refund already exists for this amount (prevent duplicates)
    const existingRefund = await prisma.refund.findFirst({
      where: { payment_id: paymentId, amount_cents, reason }
    })
    if (existingRefund && existingRefund.status === 'approved') {
      return NextResponse.json({ data: existingRefund }, { status: 200 })
    }

    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        payment_id: paymentId,
        amount_cents,
        reason,
        status: 'pending'
      }
    })

    // TODO: Call Mercado Pago API to process refund
    // const mpResult = await processMercadoPagoRefund(payment.gateway_reference, amount_cents)
    // await prisma.refund.update({
    //   where: { id: refund.id },
    //   data: {
    //     gateway_reference: mpResult.id,
    //     status: 'approved'
    //   }
    // })

    return NextResponse.json({ data: refund }, { status: 201 })
  } catch (err) {
    console.error('Error processing refund:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to process refund' } },
      { status: 500 }
    )
  }
}
