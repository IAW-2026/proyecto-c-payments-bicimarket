import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/refunds - list refunds with filters
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')
    const status = url.searchParams.get('status')
    const reason = url.searchParams.get('reason')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const sortBy = url.searchParams.get('sort') || '-created_at'

    const where: any = { deleted_at: null }
    if (paymentId) where.payment_id = paymentId
    if (status) where.status = status
    if (reason) where.reason = reason
    if (from || to) {
      where.created_at = {}
      if (from) where.created_at.gte = new Date(from)
      if (to) where.created_at.lte = new Date(to)
    }

    const skip = (page - 1) * limit
    
    // Parse sort parameter
    const [sortField, sortDir] = sortBy.startsWith('-') 
      ? [sortBy.slice(1), 'desc' as const]
      : [sortBy, 'asc' as const]

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        take: limit,
        skip,
        orderBy: { [sortField]: sortDir },
        include: {
          payment: { select: { order_id: true, status: true, amount_cents: true } },
          status_history: { orderBy: { created_at: 'desc' }, take: 1 }
        }
      }),
      prisma.refund.count({ where })
    ])

    return NextResponse.json({
      data: refunds,
      pagination: {
        page,
        limit,
        total,
        has_more: skip + limit < total
      }
    })
  } catch (err) {
    console.error('Error listing refunds:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list refunds' } },
      { status: 500 }
    )
  }
}

// POST /api/v1/refunds - create a new refund
export async function POST(req: Request) {
  try {
    // Admin-only endpoint
    const adminAuth = req.headers.get('authorization')?.startsWith('Bearer ')
    if (!adminAuth) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin authorization required' } },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { payment_id, amount_cents, reason = 'manual', seller_profile_id } = body

    if (!payment_id || !amount_cents || !reason) {
      return NextResponse.json(
        { error: { code: 'INVALID_PAYLOAD', message: 'payment_id, amount_cents, and reason are required' } },
        { status: 400 }
      )
    }

    // Get payment
    const payment = await prisma.payment.findUnique({ where: { id: payment_id } })
    if (!payment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 }
      )
    }

    // Check if payment is in approved state
    if (payment.status !== 'approved') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: `Cannot refund payment in ${payment.status} state` } },
        { status: 409 }
      )
    }

    // Validate amount
    if (amount_cents <= 0 || amount_cents > payment.amount_cents) {
      return NextResponse.json(
        { error: { code: 'INVALID_AMOUNT', message: `Refund amount must be between 0 and ${payment.amount_cents}` } },
        { status: 422 }
      )
    }

    // Create refund record
    const refund = await prisma.refund.create({
      data: {
        payment_id,
        amount_cents,
        reason,
        seller_profile_id,
        status: 'pending'
      },
      include: {
        payment: { select: { order_id: true, status: true } }
      }
    })

    // TODO: Call Mercado Pago API to process refund
    // const mpResult = await processMercadoPagoRefund(payment.gateway_reference, amount_cents)
    // await prisma.refund.update({
    //   where: { id: refund.id },
    //   data: {
    //     gateway_reference: mpResult.id,
    //     status: 'approved'
    //   }
    // })

    return NextResponse.json({ data: refund }, { status: 201 })
  } catch (err) {
    console.error('Error creating refund:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create refund' } },
      { status: 500 }
    )
  }
}
