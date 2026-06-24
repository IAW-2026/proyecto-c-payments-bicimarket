import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenSeller } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, notFound } from '@/lib/errors'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ settlementId: string }> }
) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenSeller(svcToken)) {
      const adminErr = await requireAdmin()
      if (adminErr) return adminErr
    }

    const { settlementId } = await params
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { payouts: true }
    })

    if (!settlement) {
      return notFound('SETTLEMENT_NOT_FOUND', 'Settlement not found', { settlementId })
    }

    return NextResponse.json({ data: settlement })
  } catch (err) {
    return handleRouteError(err, 'fetching settlement')
  }
}
