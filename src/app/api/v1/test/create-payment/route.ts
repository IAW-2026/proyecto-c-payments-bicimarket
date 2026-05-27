import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/errors'

export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const origin = url.origin

    const headers = new Headers()
    headers.set('Content-Type', 'application/json')

    const cookieHeader = req.headers.get('Cookie')
    if (cookieHeader) {
      headers.set('Cookie', cookieHeader)
    }

    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      headers.set('Authorization', authHeader)
    }

    const svcToken = process.env.BUYER_TO_PAYMENTS_SERVICE_TOKEN
    if (svcToken) {
      headers.set('X-Service-Token', svcToken)
    }

    const body = await req.json()

    const response = await fetch(`${origin}/api/v1/payments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    return handleRouteError(err, 'forwarding test payment to payments endpoint')
  }
}
