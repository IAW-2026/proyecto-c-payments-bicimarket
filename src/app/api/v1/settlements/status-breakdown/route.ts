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