import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/refunds/[refundId] - get refund detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ refundId: string }> }
) {
  try {
    const { refundId } = await params

    const refund = await prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        payment: {
          select: {
            id: true,
            order_id: true,
            amount_cents: true,
            status: true,
            created_at: true,
            buyer_profile_id: true
          }
        },
        status_history: {
          orderBy: { created_at: 'desc' }
        }
      }
    })

    if (!refund) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Refund not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: refund })
  } catch (err) {
    console.error('Error fetching refund:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch refund' } },
      { status: 500 }
    )
  }
}

// PATCH /api/v1/refunds/[refundId] - update refund status (manual transitions)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ refundId: string }> }
) {
  try {
    const { refundId } = await params
    const body = await req.json()
    const { status, reason } = body

    if (!status) {
      return NextResponse.json(
        { error: { code: 'INVALID_PAYLOAD', message: 'status is required' } },
        { status: 400 }
      )
    }

    const refund = await prisma.refund.findUnique({ where: { id: refundId } })
    if (!refund) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Refund not found' } },
        { status: 404 }
      )
    }

    // Update refund
    const updated = await prisma.refund.update({
      where: { id: refundId },
      data: { status },
      include: {
        payment: { select: { order_id: true } },
        status_history: { orderBy: { created_at: 'desc' }, take: 1 }
      }
    })

    // Record status change
    await prisma.refundStatusHistory.create({
      data: {
        refund_id: refundId,
        from_status: refund.status,
        to_status: status,
        changed_by: 'admin', // TODO: get from JWT
        reason
      }
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('Error updating refund:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update refund' } },
      { status: 500 }
    )
  }
}
