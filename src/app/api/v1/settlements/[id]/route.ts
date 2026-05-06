import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/settlements/{id}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const settlement = await prisma.settlement.findUnique({ where: { id } })

    if (!settlement) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Settlement not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: settlement })
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get settlement' } },
      { status: 500 }
    )
  }
}
