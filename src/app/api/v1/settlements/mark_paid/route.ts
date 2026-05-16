import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, badRequest } from '@/lib/errors'

export async function PATCH(req: Request) {
  try {
    const adminError = await requireAdmin()
    if (adminError) return adminError

    const body = await req.json()
    const { ids } = body as { ids?: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return badRequest('ids array is required')
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

        if (settlement.status !== 'pending') {
          results.push({ id: settlementId, status: 'skipped', error: `Settlement is in ${settlement.status} state, not pending` })
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
