import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, notFound, badRequest } from '@/lib/errors'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ refundId: string }> }
) {
  try {
    const { refundId } = await params
    console.log('[refunds/[refundId]] GET called, refundId:', refundId)
    const adminErr = await requireAdmin()
    if (adminErr) return adminErr

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
      return notFound('REFUND_NOT_FOUND', 'Refund not found', { refundId })
    }

    return NextResponse.json({ data: refund })
  } catch (err) {
    return handleRouteError(err, 'fetching refund')
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ refundId: string }> }
) {
  try {
    const adminErr = await requireAdmin()
    if (adminErr) return adminErr

    const { refundId } = await params
    const body = await req.json()
    const { status, reason } = body

    if (!status) {
      return badRequest('STATUS_REQUIRED', 'status is required')
    }

    const refund = await prisma.refund.findUnique({ where: { id: refundId } })
    if (!refund) {
      return notFound('REFUND_NOT_FOUND', 'Refund not found', { refundId })
    }

    const updated = await prisma.refund.update({
      where: { id: refundId },
      data: { status },
      include: {
        payment: { select: { order_id: true } },
        status_history: { orderBy: { created_at: 'desc' }, take: 1 }
      }
    })

    await prisma.refundStatusHistory.create({
      data: {
        refund_id: refundId,
        from_status: refund.status,
        to_status: status,
        changed_by: 'admin',
        reason
      }
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    return handleRouteError(err, 'updating refund')
  }
}
