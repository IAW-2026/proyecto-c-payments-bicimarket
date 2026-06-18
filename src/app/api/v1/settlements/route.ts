import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenSeller, validateServiceTokenAnalytics } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { validateSettlementTransition } from '@/lib/state-machines/settlement'
import { handleRouteError } from '@/lib/errors'

export async function PATCH(req: Request) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const body = await req.json()
    const { ids } = body as { ids?: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'ids array is required' } },
        { status: 400 }
      )
    }

    const results: Array<{ id: string; status: string; error?: string }> = []

    for (const settlementId of ids) {
      try {
        const settlement = await prisma.settlement.findUnique({
          where: { id: settlementId },
        })

        if (!settlement) {
          results.push({ id: settlementId, status: 'not_found', error: 'Settlement not found' })
          continue
        }

        try {
          validateSettlementTransition(settlement.status as any, 'paid')
        } catch {
          results.push({ id: settlementId, status: 'skipped', error: `Settlement is in ${settlement.status} state, cannot be marked as paid` })
          continue
        }

        await prisma.$transaction(async (tx) => {
          await tx.settlement.update({
            where: { id: settlementId },
            data: { status: 'paid', paid_at: new Date() },
          })

          await tx.settlementStatusHistory.create({
            data: {
              settlement_id: settlementId,
              from_status: 'pending',
              to_status: 'paid',
              changed_by: 'admin',
              reason: 'Marked as paid manually',
            },
          })
        })

        results.push({ id: settlementId, status: 'marked_paid' })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to mark as paid'
        results.push({ id: settlementId, status: 'failed', error: errorMsg })
      }
    }

    return NextResponse.json({ data: results }, { status: 200 })
  } catch (err) {
    return handleRouteError(err, 'marking settlements paid')
  }
}

export async function GET(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenAnalytics(svcToken) && !validateServiceTokenSeller(svcToken)) {
      const adminErr = await requireAdmin()
      if (adminErr) return adminErr
    }

    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')
    const sellerId = url.searchParams.get('sellerId')
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const sortBy = url.searchParams.get('sort') || '-created_at'

    const where: Record<string, unknown> = { deleted_at: null }
    if (paymentId) where.payment_id = paymentId
    if (sellerId) where.seller_profile_id = sellerId
    if (status) where.status = status
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
        { order_id: { contains: q, mode: "insensitive" } },
      ]
    }

    const skip = (page - 1) * limit

    const sortField = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
    const sortDir = sortBy.startsWith('-') ? 'desc' as const : 'asc' as const

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where: where as any,
        take: limit,
        skip,
        orderBy: { [sortField]: sortDir } as any,
        include: { payouts: true },
      }),
      prisma.settlement.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: settlements,
      pagination: { page, limit, total, has_more: skip + limit < total, next_cursor: null },
    })
  } catch (err) {
    return handleRouteError(err, 'listing settlements')
  }
}
