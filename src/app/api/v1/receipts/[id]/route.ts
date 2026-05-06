import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/receipts/{id}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const receipt = await prisma.receipt.findUnique({ where: { id } })

    if (!receipt) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Receipt not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: receipt })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get receipt' } },
      { status: 500 }
    )
  }
}