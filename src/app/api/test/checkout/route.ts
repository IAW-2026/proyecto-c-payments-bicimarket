import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()

  const origin = new URL(req.url).origin

  const idempotencyKey = req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key')

  const response = await fetch(`${origin}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Token': process.env.BUYER_TO_PAYMENTS_SERVICE_TOKEN || '',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()
  return NextResponse.json(data, { status: response.status })
}
