import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenAnalytics } from '@/lib/service-token'
import { handleRouteError, badRequest, unauthorized } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!svcToken || !validateServiceTokenAnalytics(svcToken)) {
      return unauthorized('Valid analytics service token required', 'ANALYTICS_TOKEN_REQUIRED')
    }

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    if ((from && isNaN(new Date(from).getTime())) || (to && isNaN(new Date(to).getTime()))) {
      return badRequest('INVALID_DATE', 'from and to must be valid ISO 8601 dates')
    }

    const conditions: string[] = ["status = 'paid'"]
    if (from) conditions.push(`created_at >= '${new Date(from).toISOString()}'`)
    if (to) conditions.push(`created_at <= '${new Date(to).toISOString()}'`)
    const whereClause = conditions.join(' AND ')

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT DATE_TRUNC('month', created_at)::date AS date, SUM(fee_amount_cents) AS value
      FROM "Settlement"
      WHERE ${whereClause}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY date DESC
    `)

    const data = rows.map(r => ({
      date: String(r.date).split('T')[0],
      value: Number(r.value),
    }))

    return NextResponse.json({ data })
  } catch (err) {
    return handleRouteError(err, 'computing commission timeseries')
  }
}