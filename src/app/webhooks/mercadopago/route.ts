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

    // Try JSON first — MP sends JSON even with wrong Content-Type headers
    try {
      payload = JSON.parse(bodyText)
    } catch {
      // Not JSON — try URL-encoded (IPN-style notifications)
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(bodyText)
        const topic = params.get('topic')
        const id = params.get('id')
        if (topic && id) {
          payload = { topic, data: { id }, id }
        }
      }
    }

    let dataId: string | null = payload?.data?.id || payload?.id || null

    // Handle merchant_order JSON format with resource URL instead of data.id
    if (!dataId && payload?.topic === 'merchant_order' && typeof payload?.resource === 'string') {
      const match = payload.resource.match(/\/merchant_orders\/(\d+)/)
      if (match) dataId = match[1]
    }

    // Skip non-payment entities (agreement, subscription, wallet_connect, etc.)
    if (payload?.entity && !['payment', 'merchant_order'].includes(payload.entity) && payload?.topic !== 'merchant_order') {
      console.info(`[MP Webhook] Skipping non-payment entity: ${payload.entity}`)
      return NextResponse.json({ ok: true })
    }

    // Ping / test notifications without a data.id cannot be validated;
    // ack them so MP doesn't keep retrying.
    if (!dataId) {
      console.info(`[MP Webhook] No data.id — ignoring (ct=${contentType}, body=${bodyText.slice(0, 200)})`)
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

    // ── IPN merchant_order: fetch order, process each payment ──
    if (payload?.topic === 'merchant_order') {
      const { default: mpSvc } = await import('@/services/mercado-pago.service')
      let merchantOrder: any
      try {
        merchantOrder = await mpSvc.getMerchantOrder(dataId)
      } catch (merr: any) {
        console.error('[MP Webhook] Failed fetching merchant_order', dataId, merr?.message || merr)
        return NextResponse.json({ ok: true })
      }

      const payments = merchantOrder?.payments ?? []
      for (const p of payments) {
        const paymentId = String(p.id)
        const subEventId = `merchant_order:${paymentId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`
        try {
          await prisma.mpWebhookEvent.create({
            data: {
              mp_event_id: subEventId,
              event_type: 'merchant_order_payment',
              payload: { data: { id: paymentId }, merchant_order_id: dataId, merchant_order: merchantOrder },
              signature_valid: signatureValid,
              status: 'received',
            },
          })
        } catch {}
        processMpWebhookEvent(subEventId).catch((e) => console.error('[MP Webhook] merchant_order sub-event error', e))
      }

      return NextResponse.json({ ok: true })
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
