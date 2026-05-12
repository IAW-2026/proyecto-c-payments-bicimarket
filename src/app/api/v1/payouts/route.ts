import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/payouts - list payouts
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const settlementId = url.searchParams.get('settlementId')
    const status = url.searchParams.get('status')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)

    const where: any = {}
    if (settlementId) where.settlement_id = settlementId
    if (status) where.status = status

    const skip = (page - 1) * limit

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        take: limit,
        skip,
        orderBy: { created_at: 'desc' },
        include: { settlement: true }
      }),
      prisma.payout.count({ where })
    ])

    return NextResponse.json({
      data: payouts,
      pagination: {
        page,
        limit,
        total,
        has_more: skip + limit < total
      }
    })
  } catch (err) {
    console.error('Error listing payouts:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list payouts' } }, { status: 500 })
  }
}

// POST /api/v1/payouts - create payout
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { settlement_id } = body

    if (!settlement_id) {
      return NextResponse.json({ error: { code: 'INVALID_PAYLOAD', message: 'settlement_id is required' } }, { status: 400 })
    }

    // Get settlement
    const settlement = await prisma.settlement.findUnique({ where: { id: settlement_id } })
    if (!settlement) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Settlement not found' } }, { status: 404 })
    }

    // Check if settlement is in pending state
    if (settlement.status !== 'pending') {
      return NextResponse.json({ error: { code: 'INVALID_STATE', message: `Cannot create payout for settlement in ${settlement.status} state` } }, { status: 400 })
    }

    // Check if payout already exists
    const existingPayout = await prisma.payout.findFirst({ where: { settlement_id } })
    if (existingPayout) {
      return NextResponse.json({ error: { code: 'PAYOUT_EXISTS', message: 'Payout already exists for this settlement' } }, { status: 400 })
    }

    // Create payout record
    const payout = await prisma.payout.create({ data: {
      settlement_id,
      status: 'pending',
      attempts: 0
    }})

    return NextResponse.json({ data: payout }, { status: 201 })
  } catch (err) {
    console.error('Error creating payout:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create payout' } }, { status: 500 })
  }
}
