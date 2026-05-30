import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, badRequest, notFound, unauthorized } from '@/lib/errors'
import { extractIdempotencyKey, checkIdempotency, cacheIdempotencyResponse } from '@/lib/idempotency'

export async function GET(req: Request) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const url = new URL(req.url)
    const settlementId = url.searchParams.get('settlementId')
    const status = url.searchParams.get('status')
    const q = url.searchParams.get('q')
    const from = url.searchParams.get('from')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const sortBy = url.searchParams.get('sort') || '-created_at'

    const where: Record<string, unknown> = { deleted_at: null }
    if (settlementId) where.settlement_id = settlementId
    if (status) where.status = status
    if (from) where.created_at = { gte: new Date(from) }
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { settlement_id: { contains: q, mode: "insensitive" } },
        { transfer_id: { contains: q, mode: "insensitive" } },
      ]
    }

    const skip = (page - 1) * limit

    const sortField = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
    const sortDir = sortBy.startsWith('-') ? 'desc' as const : 'asc' as const

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: where as any,
        take: limit,
        skip,
        orderBy: { [sortField]: sortDir } as any,
        include: { settlement: true },
      }),
      prisma.payout.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: payouts,
      pagination: { page, limit, total, has_more: skip + limit < total, next_cursor: null },
    })
  } catch (err) {
    return handleRouteError(err, 'listing payouts')
  }
}

export async function POST(req: Request) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const idempotencyKey = extractIdempotencyKey(req)
    if (idempotencyKey) {
      const cached = await checkIdempotency(idempotencyKey)
      if (cached.cached) return cached.response
    }

    const body = await req.json()
    const { settlement_id } = body
    if (!settlement_id) {
      return badRequest('settlement_id is required')
    }

    const settlement = await prisma.settlement.findUnique({ where: { id: settlement_id } })
    if (!settlement) {
      return notFound('Settlement not found', { settlement_id })
    }

    if (settlement.status !== 'pending') {
      return badRequest(`Cannot create payout for settlement in ${settlement.status} state`, {
        current_status: settlement.status,
      })
    }

    const existingPayout = await prisma.payout.findFirst({ where: { settlement_id } })
    if (existingPayout) {
      return badRequest('Payout already exists for this settlement', { existing_payout_id: existingPayout.id })
    }

    const payout = await prisma.payout.create({
      data: {
        settlement_id,
        status: 'in_progress',
        attempts: 0,
        started_at: new Date(),
      },
    })

    const finalPayout = await prisma.payout.findUnique({ where: { id: payout.id } })
    const response = { data: finalPayout }
    if (idempotencyKey) {
      await cacheIdempotencyResponse(idempotencyKey, response, 202)
    }
    return NextResponse.json(response, { status: 202 })
  } catch (err) {
    return handleRouteError(err, 'creating payout')
  }
}
