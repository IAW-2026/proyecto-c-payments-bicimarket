import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAnalyticsToken } from '@/lib/analytics-auth'
import { handleRouteError, badRequest } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    const authErr = requireAnalyticsToken(req)
    if (authErr) return authErr

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    if ((from && isNaN(new Date(from).getTime())) || (to && isNaN(new Date(to).getTime()))) {
      return badRequest('INVALID_DATE', 'from and to must be valid ISO 8601 dates')
    }

    const conditions: string[] = ["status = 'approved'"]
    if (from) conditions.push(`created_at >= '${new Date(from).toISOString()}'`)
    if (to) conditions.push(`created_at <= '${new Date(to).toISOString()}'`)
    const whereClause = conditions.join(' AND ')

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT DATE(created_at) AS date, SUM(amount_cents) AS value
      FROM "Payment"
      WHERE ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `)

    const data = rows.map(r => ({
      date: String(r.date).split('T')[0],
      value: Number(r.value),
    }))

    return NextResponse.json({ data })
  } catch (err) {
    return handleRouteError(err, 'computing revenue timeseries')
  }
}