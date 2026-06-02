import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, notFound, conflict } from '@/lib/errors'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const { payoutId } = await params
    const payout = await prisma.payout.findUnique({ where: { id: payoutId } })
    if (!payout) {
      return notFound('PAYOUT_NOT_FOUND', 'Payout not found', { payoutId })
    }
    if (payout.status === 'completed') {
      return conflict('ALREADY_PAID', 'Payout already marked as paid')
    }

    const [updated] = await prisma.$transaction([
      prisma.payout.update({
        where: { id: payoutId },
        data: { status: 'completed', completed_at: new Date() },
      }),
      prisma.settlement.update({
        where: { id: payout.settlement_id },
        data: { status: 'paid', paid_at: new Date() },
      }),
    ])

    return NextResponse.json({ data: updated })
  } catch (err) {
    return handleRouteError(err, 'marking payout as paid')
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const { payoutId } = await params
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        settlement: {
          include: {
            payment: {
              select: { id: true, order_id: true, amount_cents: true, status: true, created_at: true, buyer_profile_id: true },
            },
          },
        },
      },
    })

    if (!payout) {
      return notFound('PAYOUT_NOT_FOUND', 'Payout not found', { payoutId })
    }

    return NextResponse.json({ data: payout })
  } catch (err) {
    return handleRouteError(err, 'fetching payout')
  }
}
