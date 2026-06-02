import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, badRequest, notFound } from '@/lib/errors'

export async function GET(req: Request) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')
    const status = url.searchParams.get('status')
    const reason = url.searchParams.get('reason')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const sortBy = url.searchParams.get('sort') || '-created_at'

    const where: Record<string, unknown> = { deleted_at: null }
    if (paymentId) where.payment_id = paymentId
    if (status) where.status = status
    if (reason) where.reason = reason
    if (from || to) {
      where.created_at = {} as Record<string, Date>
      if (from) (where.created_at as Record<string, Date>).gte = new Date(from)
      if (to) (where.created_at as Record<string, Date>).lte = new Date(to)
    }
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { payment_id: { contains: q, mode: "insensitive" } },
        { seller_profile_id: { contains: q, mode: "insensitive" } },
        { gateway_reference: { contains: q, mode: "insensitive" } },
      ]
    }

    const skip = (page - 1) * limit

    const sortField = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
    const sortDir = sortBy.startsWith('-') ? 'desc' as const : 'asc' as const

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where: where as any,
        take: limit,
        skip,
        orderBy: { [sortField]: sortDir } as any,
        include: {
          payment: { select: { order_id: true, status: true, amount_cents: true } },
          status_history: { orderBy: { created_at: 'desc' }, take: 1 },
        },
      }),
      prisma.refund.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: refunds,
      pagination: { page, limit, total, has_more: skip + limit < total, next_cursor: null },
    })
  } catch (err) {
    return handleRouteError(err, 'listing refunds')
  }
}

