import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/errors'
import { generateRequestId } from '@/lib/request-id'

// TEST endpoint — forwards to the real /api/v1/payments adding the service token
// This avoids Clerk auth requirements during sandbox/manual testing
export async function POST(req: Request) {
  const requestId = generateRequestId()
  try {
    const url = new URL(req.url)
    const origin = url.origin

    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    headers.set('X-Request-Id', requestId)
    headers.set('User-Agent', 'bicimarket-payments-test/1.0')

    const svcToken = process.env.BUYER_TO_PAYMENTS_SERVICE_TOKEN
    if (svcToken) {
      headers.set('X-Service-Token', svcToken)
    } else {
      console.warn(`[TestPayment:${requestId}] BUYER_TO_PAYMENTS_SERVICE_TOKEN not configured`)
    }

    const body = await req.json()

    const targetUrl = `${origin}/api/v1/payments`
    console.info(`[TestPayment:${requestId}] Forwarding to ${targetUrl}`, {
      order_id: body.order_id,
      amount_cents: body.amount_cents,
      has_svc_token: !!svcToken,
      origin,
    })

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.info(`[TestPayment:${requestId}] Response: ${response.status}`, {
      has_checkout_url: !!data?.data?.checkout_url,
      payment_id: data?.data?.id,
      gateway_reference: data?.data?.gateway_reference,
      preference_warning: data?.data?.preference_warning,
    })

    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error(`[TestPayment:${requestId}] Error:`, err)
    return handleRouteError(err, 'forwarding test payment to payments endpoint')
  }
}
