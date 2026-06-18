/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAnalyticsToken } from '@/lib/analytics-auth'
import { handleRouteError } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    const authErr = requireAnalyticsToken(req)
    if (authErr) return authErr

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)
    const where = Object.keys(dateFilter).length ? { created_at: dateFilter } : {}

    const [aggregation, byReason] = await Promise.all([
      prisma.refund.aggregate({
        where: where as any,
        _count: { id: true },
        _sum: { amount_cents: true },
      }),
      prisma.refund.groupBy({
        by: ['reason'],
        where: { ...where, status: 'approved' } as any,
        _count: { id: true },
      }),
    ])

    const total = aggregation._count.id
    const total_amount_cents = aggregation._sum.amount_cents ?? 0

    const approvedCount = byReason.reduce((sum, r) => sum + r._count.id, 0)

    const by_reason = byReason.map(r => ({
      reason: r.reason,
      count: r._count.id,
    }))

    return NextResponse.json({
      data: { total, approved_count: approvedCount, total_amount_cents, by_reason },
    })
  } catch (err) {
    return handleRouteError(err, 'computing refund metrics')
  }
}