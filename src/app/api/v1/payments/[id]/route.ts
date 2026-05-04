import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/payments/{id}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await prisma.payment.findUnique({ where: { id } })

    if (!payment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: payment })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get payment' } },
      { status: 500 }
    )
  }
}
