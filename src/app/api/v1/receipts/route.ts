import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateServiceTokenBuyer } from '@/lib/service-token'
import { handleRouteError, badRequest, notFound, unauthorized } from '@/lib/errors'
import { extractIdempotencyKey, findReceiptByKey } from '@/lib/idempotency'

export async function GET(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!validateServiceTokenBuyer(svcToken)) {
      const { requireAdmin } = await import('@/lib/admin-auth')
      const adminErr = await requireAdmin()
      if (adminErr) return adminErr
    }

    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const skip = (page - 1) * limit
    const sortBy = url.searchParams.get('sort') || '-created_at'

    const where: Record<string, unknown> = {}
    if (paymentId) where.payment_id = paymentId
    if (from || to) {
      where.issued_at = {} as Record<string, Date>
      if (from) (where.issued_at as Record<string, Date>).gte = new Date(from)
      if (to) (where.issued_at as Record<string, Date>).lte = new Date(to)
    }
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { payment_id: { contains: q, mode: "insensitive" } },
        { receipt_number: { contains: q, mode: "insensitive" } },
      ]
    }

    const sortField = sortBy.startsWith('-') ? sortBy.slice(1) : sortBy
    const sortDir = sortBy.startsWith('-') ? 'desc' as const : 'asc' as const

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where: where as any,
        take: limit,
        skip,
        orderBy: { [sortField]: sortDir } as any,
      }),
      prisma.receipt.count({ where: where as any }),
    ])

    return NextResponse.json({
      data: receipts,
      pagination: { page, limit, total, has_more: skip + limit < total, next_cursor: null },
    })
  } catch (err) {
    return handleRouteError(err, 'listing receipts')
  }
}

export async function POST(req: Request) {
  try {
    const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
    if (!svcToken || (!validateServiceTokenBuyer(svcToken))) {
      return unauthorized('Valid service token required', 'SERVICE_TOKEN_REQUIRED')
    }

    const idempotencyKey = extractIdempotencyKey(req)
    if (idempotencyKey) {
      const existing = await findReceiptByKey(idempotencyKey)
      if (existing) {
        return NextResponse.json({ data: existing }, { status: 200 })
      }
    }

    const body = await req.json()
    const requiredFields = ['payment_id', 'receipt_number', 'receipt_url', 'amount_cents', 'issued_at']
    for (const field of requiredFields) {
      if (!body[field]) {
        return badRequest('MISSING_REQUIRED_FIELD', `Missing required field: ${field}`)
      }
    }

    const payment = await prisma.payment.findUnique({ where: { id: body.payment_id } })
    if (!payment) {
      return notFound('PAYMENT_NOT_FOUND', 'Payment not found', { payment_id: body.payment_id })
    }

    const receipt = await prisma.receipt.create({
      data: {
        payment_id: body.payment_id,
        receipt_number: body.receipt_number,
        receipt_url: body.receipt_url,
        amount_cents: body.amount_cents,
        issued_at: new Date(body.issued_at),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      },
    })

    return NextResponse.json({ data: receipt }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'creating receipt')
  }
}
