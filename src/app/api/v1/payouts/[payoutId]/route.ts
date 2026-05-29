import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

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
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Payout not found' } }, { status: 404 })
    }
    if (payout.status === 'completed') {
      return NextResponse.json({ error: { code: 'ALREADY_PAID', message: 'Payout already marked as paid' } }, { status: 409 })
    }

    const updated = await prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'completed', completed_at: new Date() },
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

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('Error marking payout as paid:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to mark payout as paid' } },
      { status: 500 },
    )
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
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Payout not found' } },
        { status: 404 },
      )
    }

    return NextResponse.json({ data: payout })
  } catch (err) {
    console.error('Error fetching payout:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payout' } },
      { status: 500 },
    )
  }
}
