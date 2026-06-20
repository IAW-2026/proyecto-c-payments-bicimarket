import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validatePaymentWebhookSignature } from '@/lib/webhook-signature'
import { processMpWebhookEvent } from '@/services/mp-webhook-processor'

export const maxDuration = 60

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

    // Third fallback: query params from URL (IPN via notification_url sends ?id=&topic=)
    if (!payload || (!payload?.data?.id && !payload?.id)) {
      try {
        const reqUrl = new URL(req.url)
        const urlId = reqUrl.searchParams.get('id')
        const urlTopic = reqUrl.searchParams.get('topic')
        if (urlId) {
          payload = { ...(payload || {}), data: { id: urlId }, id: urlId, topic: payload?.topic || urlTopic || 'unknown' }
        }
      } catch { /* invalid URL */ }
    }

    const rawId = payload?.data?.id ?? payload?.id ?? null
    let dataId: string | null = rawId != null ? String(rawId) : null

    const notifType = payload?.topic || payload?.type || payload?.action || 'unknown'
    console.log(`[MP Flow] Webhook received dataId=${dataId} type=${notifType} hasSignature=${!!signatureHeader}`)

    function isMerchantOrderNotification(p: any): boolean {
      const t = (p?.type || '').toString().toLowerCase()
      const a = (p?.action || '').toString().toLowerCase()
      return p?.topic === 'merchant_order'
        || t === 'merchant_order'
        || t === 'topic_merchant_order_wh'
        || t === 'merchant_order_wh'
        || t.includes('merchant_order')
        || a.startsWith('merchant_order')
    }

    // Handle merchant_order JSON format with resource URL instead of data.id
    if (!dataId && isMerchantOrderNotification(payload) && typeof payload?.resource === 'string') {
      const match = payload.resource.match(/\/merchant_orders\/(\d+)/)
      if (match) dataId = match[1]
    }

    // Skip non-payment entities (agreement, subscription, wallet_connect, etc.)
    if (payload?.entity && !['payment', 'merchant_order'].includes(payload.entity) && !isMerchantOrderNotification(payload)) {
      return NextResponse.json({ ok: true })
    }

    // Ping / test notifications without a data.id cannot be validated;
    // ack them so MP doesn't keep retrying.
    if (!dataId) {
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

    const isMerchantOrder = isMerchantOrderNotification(payload)
    console.log(`[MP Flow] isMerchantOrder=${isMerchantOrder} dataId=${dataId}`)
    const validation = validatePaymentWebhookSignature(signatureHeader, xRequestId, dataId)
    const signatureValid = signatureHeader ? validation.valid : false

    const action = payload?.action || payload?.topic || 'unknown'
    const mpEventId = xRequestId || `${action}:${dataId}`

    let isRetryOfFailed = false
    try {
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: mpEventId,
          event_type: payload?.topic || 'unknown',
          payload: payload ?? bodyText,
          signature_valid: signatureValid,
        },
      })
      console.log(`[MP Flow] Main event created mpEventId=${mpEventId}`)
    } catch (dbErr: any) {
      if (dbErr?.code === 'P2002') {
        console.log(`[MP Flow] Main event P2002 mpEventId=${mpEventId}`)
        try {
          const existing = await prisma.mpWebhookEvent.findUnique({ where: { mp_event_id: mpEventId } })
          if (existing && (existing.status === 'failed' || existing.status === 'processing')) {
            console.log(`[MP Flow] Retrying ${existing.status} event ${mpEventId}`)
            await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'received', last_error: null, processed_at: null } })
            isRetryOfFailed = true
          } else {
            console.log(`[MP Flow] Skipping duplicate mpEventId=${mpEventId} status=${existing?.status}`)
            return NextResponse.json({ ok: true })
          }
        } catch {
          return NextResponse.json({ ok: true })
        }
      } else {
        console.error('[MP Webhook] Failed to persist event:', dbErr)
      }
    }

    // IPN notifications (no x-signature header) are processed without signature verification.
    // Only reject when a signature WAS provided but is invalid.
    if (signatureHeader && !signatureValid) {
      console.warn('[MP Webhook] Invalid signature for', mpEventId)
      return NextResponse.json({ ok: false, reason: 'invalid_signature' }, { status: 400 })
    }

    // ── Merchant_order: fetch order, process each payment ──
    if (isMerchantOrder) {
      console.log(`[MP Flow] Entering merchant_order branch dataId=${dataId}`)
      const { default: mpSvc } = await import('@/services/mercado-pago.service')
      let merchantOrder: any
      try {
        merchantOrder = await mpSvc.getMerchantOrder(dataId)
        console.log(`[MP Flow] Merchant order fetched id=${merchantOrder?.id} payments_count=${merchantOrder?.payments?.length ?? 0}`)
      } catch (merr: any) {
        console.error('[MP Flow] Failed fetching merchant_order', dataId, merr?.message || merr)
        return NextResponse.json({ ok: true })
      }

      const payments = merchantOrder?.payments ?? []
      for (const p of payments) {
        const paymentId = String(p.id)
        const subEventId = `merchant_order:${paymentId}:${dataId}`
        console.log(`[MP Flow] Processing sub-event paymentId=${paymentId} subEventId=${subEventId}`)
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
          console.log(`[MP Flow] Sub-event created, calling processMpWebhookEvent(${subEventId})`)
          processMpWebhookEvent(subEventId).catch((e) => console.error('[MP Webhook] merchant_order sub-event error', e))
        } catch (subErr: any) {
          if (subErr?.code === 'P2002') {
            console.log(`[MP Flow] Sub-event P2002 subEventId=${subEventId}`)
            try {
              const existing = await prisma.mpWebhookEvent.findUnique({ where: { mp_event_id: subEventId } })
              console.log(`[MP Flow] Existing sub-event status=${existing?.status} subEventId=${subEventId}`)
              if (existing && (existing.status === 'failed' || existing.status === 'processing')) {
                console.log(`[MP Flow] Retrying ${existing.status} sub-event ${subEventId}`)
                await prisma.mpWebhookEvent.update({ where: { mp_event_id: subEventId }, data: { status: 'received', last_error: null, processed_at: null } })
                processMpWebhookEvent(subEventId).catch((e) => console.error('[MP Webhook] merchant_order sub-event retry error', e))
              } else {
                console.log(`[MP Flow] Skipping duplicate sub-event ${subEventId} status=${existing?.status}`)
              }
            } catch {}
          } else {
            console.error(`[MP Flow] Sub-event create error (non-P2002) subEventId=${subEventId}`, subErr)
          }
        }
      }

      return NextResponse.json({ ok: true })
    }

    console.log(`[MP Flow] Calling processMpWebhookEvent directly for ${mpEventId}`)
    try {
      await processMpWebhookEvent(mpEventId)
    } catch (procErr) {
      console.error('[MP Webhook] Processor error:', procErr)
    }

    console.log(`[MP Flow] Webhook handler done for ${mpEventId}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[MP Webhook] Error handling webhook:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
