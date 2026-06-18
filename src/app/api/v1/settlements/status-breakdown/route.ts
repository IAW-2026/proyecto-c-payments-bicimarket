/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenAnalytics } from '@/lib/service-token'
import { handleRouteError, unauthorized } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    console.log('[settlements/status-breakdown] GET called, path:', req.url)
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    console.log('[settlements/status-breakdown] X-Service-Token present:', !!svcToken)
    const envVar = process.env['DASHBOARD_TO_PAYMENTS_SERVICE_TOKEN']
    console.log('[settlements/status-breakdown] DASHBOARD_TO_PAYMENTS_SERVICE_TOKEN configured:', !!envVar)
    console.log('[settlements/status-breakdown] token match:', svcToken === envVar)
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

    const rows = await prisma.settlement.groupBy({
      by: ['status'],
      where: where as any,
      _count: { id: true },
    })

    const data = rows.map(r => ({
      status: r.status,
      count: r._count.id,
    }))

    return NextResponse.json({ data })
  } catch (err) {
    return handleRouteError(err, 'computing settlement status breakdown')
  }
}