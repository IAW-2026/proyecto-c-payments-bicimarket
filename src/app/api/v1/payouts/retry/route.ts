import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleRouteError, badRequest } from '@/lib/errors'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ids } = body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest('ids array is required')
    }

    const payouts = await prisma.payout.findMany({
      where: {
        id: { in: ids },
        status: { in: ['failed', 'manual_review'] },
        deleted_at: null,
      },
    })

    if (payouts.length === 0) {
      return badRequest('No retriable payouts found for the given ids')
    }

    const updated = await prisma.payout.updateMany({
      where: {
        id: { in: payouts.map((p) => p.id) },
      },
      data: {
        status: 'pending',
        last_error: null,
        attempts: 0,
      },
    })

    return NextResponse.json({ data: { count: updated.count } })
  } catch (err) {
    return handleRouteError(err, 'retrying payouts')
  }
}
