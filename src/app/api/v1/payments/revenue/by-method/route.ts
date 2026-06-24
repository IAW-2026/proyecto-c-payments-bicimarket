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

    const where: Record<string, unknown> = { status: 'approved' }
    if (Object.keys(dateFilter).length) where.created_at = dateFilter

    const rows = await prisma.payment.groupBy({
      by: ['method'],
      where: where as any,
      _sum: { amount_cents: true },
      orderBy: { _sum: { amount_cents: 'desc' } },
    })

    const total = rows.reduce((acc, r) => acc + (r._sum.amount_cents ?? 0), 0)
    const data = rows
      .filter(r => r.method !== null)
      .map(r => ({
        method: r.method!,
        value: r._sum.amount_cents ?? 0,
        percentage: total > 0 ? Math.round(((r._sum.amount_cents ?? 0) / total) * 10000) / 100 : 0,
      }))

    return NextResponse.json({ data })
  } catch (err) {
    return handleRouteError(err, 'computing revenue by method')
  }
}