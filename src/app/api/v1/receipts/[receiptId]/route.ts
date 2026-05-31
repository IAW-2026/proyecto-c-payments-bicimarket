import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenBuyer } from '@/lib/service-token'
import { requireAdmin } from '@/lib/admin-auth'
import { handleRouteError, notFound } from '@/lib/errors'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ receiptId: string }> }
) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenBuyer(svcToken)) {
      const adminErr = await requireAdmin()
      if (adminErr) return adminErr
    }

    const { receiptId } = await params
    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } })

    if (!receipt) {
      return notFound('RECEIPT_NOT_FOUND', 'Receipt not found', { receiptId })
    }

    return NextResponse.json({ data: receipt })
  } catch (err) {
    return handleRouteError(err, 'fetching receipt')
  }
}