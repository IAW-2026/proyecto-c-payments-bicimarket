/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenAnalytics } from '@/lib/service-token'
import { handleRouteError, unauthorized } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    console.log('[refunds/metrics] GET called, path:', req.url)
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    console.log('[refunds/metrics] X-Service-Token present:', !!svcToken)
    const envVar = process.env['DASHBOARD_TO_PAYMENTS_SERVICE_TOKEN']
    console.log('[refunds/metrics] DASHBOARD_TO_PAYMENTS_SERVICE_TOKEN configured:', !!envVar)
    console.log('[refunds/metrics] token match:', svcToken === envVar)
    if (!svcToken || !validateServiceTokenAnalytics(svcToken)) {
      return unauthorized('Valid analytics service token required', 'ANALYTICS_TOKEN_REQUIRED')
    }

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