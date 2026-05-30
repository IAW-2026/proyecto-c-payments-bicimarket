import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleRouteError } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')
    const sellerId = url.searchParams.get('sellerId')
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const sortBy = url.searchParams.get('sort') || '-created_at'

    const where: Record<string, unknown> = { deleted_at: null }
    if (paymentId) where.payment_id = paymentId
    if (sellerId) where.seller_profile_id = sellerId
    if (status) where.status = status
    if (from || to) {
      where.created_at = {} as Record<string, Date>
      if (from) (where.created_at as Record<string, Date>).gte = new Date(from)
      if (to) (where.created_at as Record<string, Date>).lte = new Date(to)
    }
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { payment_id: { contains: q, mode: "insensitive" } },
        { seller_profile_id: { contains: q, mode: "insensitive" } },
        { order_id: { contains: q, mode: "insensitive" } },
      ]
    }

    const skip = (page - 1) * limit

    const sortField = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
    const sortDir = sortBy.startsWith('-') ? 'desc' as const : 'asc' as const

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where: where as any,
        take: limit,
        skip,
        orderBy: { [sortField]: sortDir } as any,
        include: { payouts: true },
      }),
      prisma.settlement.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: settlements,
      pagination: { page, limit, total, has_more: skip + limit < total, next_cursor: null },
    })
  } catch (err) {
    return handleRouteError(err, 'listing settlements')
  }
}
