/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenAnalytics } from '@/lib/service-token'
import { handleRouteError, unauthorized } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    console.log('[settlements/pending-by-seller] GET called, path:', req.url)
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    console.log('[settlements/pending-by-seller] X-Service-Token present:', !!svcToken)
    const envVar = process.env['DASHBOARD_TO_PAYMENTS_SERVICE_TOKEN']
    console.log('[settlements/pending-by-seller] DASHBOARD_TO_PAYMENTS_SERVICE_TOKEN configured:', !!envVar)
    console.log('[settlements/pending-by-seller] token match:', svcToken === envVar)
    if (!svcToken || !validateServiceTokenAnalytics(svcToken)) {
      return unauthorized('Valid analytics service token required', 'ANALYTICS_TOKEN_REQUIRED')
    }

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    const dateFilter: Record<string, Date> = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)

    const where: Record<string, unknown> = { status: 'pending' }
    if (Object.keys(dateFilter).length) where.created_at = dateFilter

    const rows = await prisma.settlement.groupBy({
      by: ['seller_profile_id'],
      where: where as any,
      _sum: { gross_amount_cents: true },
      _count: { id: true },
      orderBy: { _sum: { gross_amount_cents: 'desc' } },
    })

    const data = rows.map(r => ({
      seller_profile_id: r.seller_profile_id,
      pending_count: r._count.id,
      total_cents: r._sum.gross_amount_cents ?? 0,
    }))

    return NextResponse.json({ data })
  } catch (err) {
    return handleRouteError(err, 'computing pending settlements by seller')
  }
}