import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: Request) {
  const body = await req.json()
  const serviceToken = process.env.BUYER_TO_PAYMENTS_SERVICE_TOKEN

  if (!serviceToken) {
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'BUYER_TO_PAYMENTS_SERVICE_TOKEN not configured' } },
      { status: 500 },
    )
  }

  const origin = req.headers.get('origin') || 'http://localhost:3000'
  const idempotencyKey = crypto.randomUUID()

  try {
    const res = await fetch(`${origin}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': serviceToken,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy request failed'
    return NextResponse.json(
      { error: { code: 'PROXY_ERROR', message } },
      { status: 502 },
    )
  }
}
