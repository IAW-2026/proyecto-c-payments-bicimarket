import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validatePaymentWebhookSignature } from '@/lib/webhook-signature'
import { enqueueJob, processJobQueue } from '@/services/job-queue.service'

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

    let shouldEnqueue = false
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
      shouldEnqueue = true
    } catch (dbErr: any) {
      if (dbErr?.code === 'P2002') {
        console.log(`[MP Flow] Main event P2002 mpEventId=${mpEventId}`)
        try {
          const existing = await prisma.mpWebhookEvent.findUnique({ where: { mp_event_id: mpEventId } })
          if (existing && (existing.status === 'received' || existing.status === 'failed' || existing.status === 'processing')) {
            console.log(`[MP Flow] Retrying ${existing.status} event ${mpEventId}`)
            await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'received', last_error: null, processed_at: null } })
            shouldEnqueue = true
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

    // Log invalid signatures but process anyway. Payment webhooks frequently fail
    // signature validation but carry a valid dataId that processMpWebhookEvent can
    // use to fetch payment details from MP API directly.
    if (signatureHeader && !signatureValid) {
      console.warn('[MP Webhook] Invalid signature for', mpEventId, '— processing anyway')
    }

    // ── Merchant_order: fetch order, enqueue jobs for each payment ──
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
          console.log(`[MP Flow] Sub-event created, enqueuing job for ${subEventId}`)
          await enqueueJob(subEventId, 'process_webhook', { mp_event_id: subEventId })
        } catch (subErr: any) {
          if (subErr?.code === 'P2002') {
            console.log(`[MP Flow] Sub-event P2002 subEventId=${subEventId}`)
            try {
              const existing = await prisma.mpWebhookEvent.findUnique({ where: { mp_event_id: subEventId } })
              console.log(`[MP Flow] Existing sub-event status=${existing?.status} subEventId=${subEventId}`)
              if (existing && (existing.status === 'received' || existing.status === 'failed' || existing.status === 'processing')) {
                console.log(`[MP Flow] Re-enqueuing ${existing.status} sub-event ${subEventId}`)
                await prisma.mpWebhookEvent.update({ where: { mp_event_id: subEventId }, data: { status: 'received', last_error: null, processed_at: null } })
                await enqueueJob(subEventId, 'process_webhook', { mp_event_id: subEventId })
              } else {
                console.log(`[MP Flow] Skipping duplicate sub-event ${subEventId} status=${existing?.status}`)
              }
            } catch {}
          } else {
            console.error(`[MP Flow] Sub-event create error (non-P2002) subEventId=${subEventId}`, subErr)
          }
        }
      }

      // Drain the queue before returning (loop to catch jobs enqueued by handlers)
      while (await processJobQueue() > 0) {}
      console.log(`[MP Flow] Merchant_order handler done for ${mpEventId}`)
      return NextResponse.json({ ok: true })
    }

    // ── Payment webhook: enqueue job for direct processing ──
    if (shouldEnqueue) {
      console.log(`[MP Flow] Enqueuing job for ${mpEventId}`)
      await enqueueJob(mpEventId, 'process_webhook', { mp_event_id: mpEventId })
    }

    // Drain queue before returning (loop to catch jobs enqueued by handlers)
    while (await processJobQueue() > 0) {}
    console.log(`[MP Flow] Webhook handler done for ${mpEventId}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[MP Webhook] Error handling webhook:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
