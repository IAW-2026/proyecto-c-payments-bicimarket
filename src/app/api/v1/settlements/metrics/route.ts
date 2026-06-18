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

    const [aggregation, statusCounts, paidWithDate] = await Promise.all([
      prisma.settlement.aggregate({
        where: where as any,
        _sum: { gross_amount_cents: true, fee_amount_cents: true, net_amount_cents: true },
        _count: { id: true },
      }),
      prisma.settlement.groupBy({
        by: ['status'],
        where: where as any,
        _count: { id: true },
      }),
      prisma.settlement.findMany({
        where: { ...where, status: 'paid', paid_at: { not: null } } as any,
        select: { created_at: true, paid_at: true },
      }),
    ])

    const statusMap: Record<string, number> = {}
    for (const s of statusCounts) {
      statusMap[s.status] = s._count.id
    }

    let totalVelocityDays = 0
    let velocityCount = 0
    for (const s of paidWithDate) {
      if (s.paid_at) {
        const diff = (s.paid_at.getTime() - s.created_at.getTime()) / (1000 * 60 * 60 * 24)
        totalVelocityDays += diff
        velocityCount++
      }
    }

    const avg_velocity_days = velocityCount > 0 ? Math.round((totalVelocityDays / velocityCount) * 100) / 100 : 0

    return NextResponse.json({
      data: {
        total_cents: aggregation._sum.gross_amount_cents ?? 0,
        fee_cents: aggregation._sum.fee_amount_cents ?? 0,
        net_cents: aggregation._sum.net_amount_cents ?? 0,
        total_count: aggregation._count.id,
        pending_count: statusMap['pending'] ?? 0,
        paid_count: statusMap['paid'] ?? 0,
        failed_count: statusMap['failed'] ?? 0,
        manual_review_count: statusMap['manual_review'] ?? 0,
        avg_velocity_days,
      },
    })
  } catch (err) {
    return handleRouteError(err, 'computing settlement metrics')
  }
}