import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/v1/receipts - List receipts
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')
    const page = Number(url.searchParams.get('page')) || 1
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const skip = (page - 1) * limit

    const where: any = {}
    if (paymentId) where.payment_id = paymentId

    const [receipts, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        take: limit,
        skip,
        orderBy: { created_at: 'desc' }
      }),
      prisma.receipt.count({ where })
    ])

    return NextResponse.json({
      data: receipts,
      pagination: {
        page,
        limit,
        total,
        has_more: skip + limit < total
      }
    })
  } catch (err) {
    console.error('Error listing receipts:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list receipts' } },
      { status: 500 }
    )
  }
}

// POST /api/v1/receipts - Create receipt (internal trigger after payment approved)
export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Validate required fields
    const requiredFields = ['payment_id', 'receipt_number', 'receipt_url', 'amount_cents', 'issued_at']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: { code: 'INVALID_PAYLOAD', message: `Missing required field: ${field}` } },
          { status: 400 }
        )
      }
    }

    // Verify payment exists
    const payment = await prisma.payment.findUnique({
      where: { id: body.payment_id }
    })

    if (!payment) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Payment not found', details: { payment_id: body.payment_id } } },
        { status: 404 }
      )
    }

    // Create receipt
    const receipt = await prisma.receipt.create({
      data: {
        payment_id: body.payment_id,
        receipt_number: body.receipt_number,
        receipt_url: body.receipt_url,
        amount_cents: body.amount_cents,
        issued_at: new Date(body.issued_at)
      }
    })

    return NextResponse.json({ data: receipt }, { status: 201 })
  } catch (err) {
    console.error('Error creating receipt:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create receipt' } },
      { status: 500 }
    )
  }
}
