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

    const conditions: string[] = ["p.status = 'approved'"]
    if (from) conditions.push(`p.created_at >= '${new Date(from).toISOString()}'`)
    if (to) conditions.push(`p.created_at <= '${new Date(to).toISOString()}'`)
    const whereClause = conditions.join(' AND ')

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT
        seller->>'seller_profile_id' AS seller_profile_id,
        SUM((seller->>'subtotal_cents')::int + (seller->>'shipping_cost_cents')::int) AS revenue_cents
      FROM "Payment" p
      CROSS JOIN LATERAL jsonb_array_elements(p.items_summary::jsonb) AS seller
      WHERE ${whereClause}
        AND p.items_summary IS NOT NULL
        AND p.items_summary::text <> '[]'
      GROUP BY seller->>'seller_profile_id'
      ORDER BY revenue_cents DESC
    `)

    const data = rows.map(r => ({
      seller_profile_id: String(r.seller_profile_id),
      revenue_cents: Number(r.revenue_cents),
    }))

    return NextResponse.json({ data })
  } catch (err) {
    return handleRouteError(err, 'computing revenue by seller')
  }
}