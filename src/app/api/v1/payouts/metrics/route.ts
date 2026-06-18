/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenAnalytics } from '@/lib/service-token'
import { handleRouteError, unauthorized } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
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

    const [aggregation, statusCounts] = await Promise.all([
      prisma.payout.aggregate({
        where: where as any,
        _count: { id: true },
      }),
      prisma.payout.groupBy({
        by: ['status'],
        where: where as any,
        _count: { id: true },
      }),
    ])

    const statusMap: Record<string, number> = {}
    for (const s of statusCounts) {
      statusMap[s.status] = s._count.id
    }

    return NextResponse.json({
      data: {
        count: aggregation._count.id,
        completed_count: statusMap['completed'] ?? 0,
        failed_count: statusMap['failed'] ?? 0,
        in_progress_count: statusMap['in_progress'] ?? 0,
        pending_count: statusMap['pending'] ?? 0,
        manual_review_count: statusMap['manual_review'] ?? 0,
      },
    })
  } catch (err) {
    return handleRouteError(err, 'computing payout metrics')
  }
}