import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenBuyer } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, notFound } from '@/lib/errors'

export async function GET(
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
      return notFound('PAYMENT_NOT_FOUND', 'Payment not found', { paymentId })
    }

    return NextResponse.json({ data: payment })
  } catch (err) {
    return handleRouteError(err, 'fetching payment')
  }
}
