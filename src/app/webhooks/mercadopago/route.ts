import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validatePaymentWebhookSignature, isTimestampFresh } from '@/lib/webhook-signature'
import { processMpWebhookEvent } from '@/services/mp-webhook-processor'

export async function POST(req: Request) {
  try {
    const signatureHeader = req.headers.get('x-signature') || req.headers.get('X-Signature')
    const xRequestId = req.headers.get('x-request-id') || req.headers.get('X-Request-Id')

    const bodyText = await req.text()
    let payload: any = null
    try {
      payload = JSON.parse(bodyText)
    } catch (e) {
      // Some providers post urlencoded or plain text; store raw
    }

    const dataId = payload?.data?.id || payload?.id || null

    const validation = validatePaymentWebhookSignature(signatureHeader, xRequestId, dataId)
    const signatureValid = validation.valid && (validation.ts ? isTimestampFresh(validation.ts) : false)

    const mpEventId = xRequestId || `${payload?.topic || 'mp'}:${dataId || 'unknown'}:${Date.now()}`

    try {
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: mpEventId,
          event_type: payload?.topic || 'unknown',
          payload: payload ?? bodyText,
          signature_valid: signatureValid,
        },
      })
    } catch (dbErr) {
      console.error('[MP Webhook] Failed to persist event:', dbErr)
    }

    if (!signatureValid) {
      console.warn('[MP Webhook] Invalid signature')
      return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 400 })
    }

    // Process the webhook synchronously before responding.
    // Using setImmediate/fire-and-forget is unreliable in serverless environments
    // where the runtime may freeze the function after the response is sent.
    try {
      await processMpWebhookEvent(mpEventId)
    } catch (procErr) {
      console.error('[MP Webhook] Processor error:', procErr)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[MP Webhook] Error handling webhook:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
