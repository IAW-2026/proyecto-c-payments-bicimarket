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

    const [aggregation, approvedCount] = await Promise.all([
      prisma.payment.aggregate({
        where: where as any,
        _sum: { amount_cents: true },
        _count: { id: true },
        _avg: { amount_cents: true },
      }),
      prisma.payment.count({
        where: { ...where, status: 'approved' } as any,
      }),
    ])

    const total_cents = aggregation._sum.amount_cents ?? 0
    const count = aggregation._count.id
    const avg_order_cents = Math.round(aggregation._avg.amount_cents ?? 0)
    const success_rate = count > 0 ? Math.round((approvedCount / count) * 10000) / 100 : 0

    return NextResponse.json({
      data: { total_cents, count, approved_count: approvedCount, avg_order_cents, success_rate },
    })
  } catch (err) {
    return handleRouteError(err, 'computing payment metrics')
  }
}