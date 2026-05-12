import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/settlements/{id}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  try {
    const { settlementId } = await params
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { payouts: true }
    })

    if (!settlement) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Settlement not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: settlement })
  } catch (err) {
    console.error('Error fetching settlement:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get settlement' } },
      { status: 500 }
    )
  }
}
