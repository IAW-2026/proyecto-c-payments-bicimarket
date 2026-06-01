import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validatePaymentWebhookSignature, isTimestampFresh } from '@/lib/webhook-signature'
import { processMpWebhookEvent } from '@/services/mp-webhook-processor'

export async function POST(req: Request) {
  try {
    const signatureHeader = req.headers.get('x-signature') || req.headers.get('X-Signature')
    const xRequestId = req.headers.get('x-request-id') || req.headers.get('X-Request-Id')
    const contentType = req.headers.get('content-type') || ''

    const bodyText = await req.text()
    let payload: any = null

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(bodyText)
      const topic = params.get('topic')
      const id = params.get('id')
      if (topic && id) {
        payload = { topic, data: { id }, id: params.get('id') }
      }
    } else {
      try {
        payload = JSON.parse(bodyText)
      } catch {
        // not JSON — store raw
      }
    }

    const dataId = payload?.data?.id || payload?.id || null

    // Ping / test notifications without a data.id cannot be validated;
    // ack them so MP doesn't keep retrying.
    if (!dataId) {
      console.info('[MP Webhook] Ignoring notification without data.id (ping/test)')
      try {
        await prisma.mpWebhookEvent.create({
          data: {
            mp_event_id: `ping:${Date.now()}`,
            event_type: payload?.topic || 'ping',
            payload: payload ?? bodyText,
            signature_valid: false,
          },
        })
      } catch { /* best-effort */ }
      return NextResponse.json({ ok: true })
    }

    const validation = validatePaymentWebhookSignature(signatureHeader, xRequestId, dataId)
    const signatureValid = validation.valid && (validation.ts ? isTimestampFresh(validation.ts) : false)

    const action = payload?.action || payload?.topic || 'unknown'
    const mpEventId = xRequestId || `${action}:${dataId}`

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
      console.warn('[MP Webhook] Invalid signature for', mpEventId)
      return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 400 })
    }

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
