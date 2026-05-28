import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateMercadoPagoSignature } from '@/lib/webhook-signature'
import { getPayment as getMpPayment } from '@/services/mercado-pago.service'
import { notifyBuyerOrderStatus, createSellerSalesOrder } from '@/services/inter-app-client.service'
import { errorResponse } from '@/lib/errors'
import type { PaymentMethod } from '@/generated/prisma/client'

function getRawBody(req: Request): Promise<string> {
  return req.text()
}

export async function POST(req: Request) {
  const requestId = req.headers.get('x-request-id') || 'unknown'
  console.info(`[Webhook] Received webhook request x-request-id=${requestId}`)

  try {
    const rawBody = await getRawBody(req)
    const signature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    const url = new URL(req.url)
    const dataId = url.searchParams.get('data.id')

    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      console.error('[Webhook] Invalid JSON body')
      return errorResponse('BAD_REQUEST', 'Invalid JSON body', 400)
    }

    const bodyDataId = payload?.data && typeof payload.data === 'object'
      ? String((payload.data as Record<string, unknown>).id ?? '')
      : ''
    const notificationDataId = dataId || bodyDataId || null

    const signatureValid = validateMercadoPagoSignature(signature, xRequestId, notificationDataId)

    const mpEventId = payload?.id ? String(payload.id) : `evt_${Date.now()}`
    const eventType = (payload?.type as string) || 'unknown'

    console.info(`[Webhook] Event: ${eventType} | mp_event_id=${mpEventId} | signature_valid=${signatureValid}`)

    // Deduplication: atomically create event or handle existing
    // The unique constraint on mp_event_id ensures only one request creates the event
    try {
      await prisma.mpWebhookEvent.create({
        data: {
          mp_event_id: mpEventId,
          event_type: eventType,
          payload,
          signature_valid: signatureValid,
          status: 'processing',
        },
      })
    } catch (createErr) {
      // Duck-type check for Prisma P2002 unique constraint violation
      const isP2002 = createErr instanceof Error
        && 'code' in createErr
        && (createErr as { code: string }).code === 'P2002'
      if (!isP2002) {
        throw createErr // unexpected error
      }
      // P2002: event already created by another request — look it up
      const existingEvent = await prisma.mpWebhookEvent.findUnique({
        where: { mp_event_id: mpEventId },
      })
      if (!existingEvent) {
        console.warn(`[Webhook] P2002 race but event ${mpEventId} not found — continuing`)
      } else if (existingEvent.status === 'processed') {
        console.info(`[Webhook] Duplicate event ${mpEventId} already processed, skipping`)
        return NextResponse.json({ received: true, deduplicated: true }, { status: 200 })
      } else if (existingEvent.status === 'processing') {
        console.info(`[Webhook] Duplicate event ${mpEventId} currently being processed, skipping`)
        return NextResponse.json({ received: true, deduplicated: true }, { status: 200 })
      } else if (!existingEvent.signature_valid) {
        // Signature was already invalid — will never pass, skip retry
        console.info(`[Webhook] Duplicate event ${mpEventId} skipped (signature invalid, status=${existingEvent.status})`)
        return NextResponse.json({ received: true, deduplicated: true }, { status: 200 })
      } else {
        // Previous attempt failed for a transient reason — retry
        console.info(`[Webhook] Re-processing previously failed event ${mpEventId} (status=${existingEvent.status})`)
        await prisma.mpWebhookEvent.update({
          where: { id: existingEvent.id },
          data: { payload, signature_valid: signatureValid, status: 'processing', last_error: null },
        })
      }
    }

    if (!signatureValid) {
      console.warn(`[Webhook] Invalid signature for event ${mpEventId}. Accepting but will not process.`)
      await prisma.mpWebhookEvent.update({
        where: { mp_event_id: mpEventId },
        data: { status: 'failed', last_error: 'Invalid signature' },
      })
      return NextResponse.json({ received: true, warning: 'Invalid signature' }, { status: 200 })
    }

    try {
      await processWebhookEvent(payload)
      await prisma.mpWebhookEvent.update({
        where: { mp_event_id: mpEventId },
        data: { status: 'processed', processed_at: new Date() },
      })
    } catch (procErr) {
      console.error(`[Webhook] Processing failed for event ${mpEventId}:`, procErr)
      await prisma.mpWebhookEvent.update({
        where: { mp_event_id: mpEventId },
        data: {
          status: 'failed',
          last_error: procErr instanceof Error ? procErr.message : String(procErr),
        },
      })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('[Webhook] Fatal error processing webhook:', err)
    return NextResponse.json({ received: true, error: 'Webhook processing failed' }, { status: 200 })
  }
}

async function processWebhookEvent(payload: Record<string, unknown>) {
  const eventType = (payload?.type as string) || ''
  const resource = payload?.data ? (payload.data as Record<string, unknown>)?.id as string : undefined

  if (!resource) {
    console.warn('[Webhook] No resource ID in payload:', payload?.id)
    return
  }

  if (eventType.includes('payment')) {
    console.info(`[Webhook] Processing payment event: ${eventType} | resource=${resource}`)
    await handlePaymentEvent(resource)
  } else {
    console.info(`[Webhook] Ignoring non-payment event: ${eventType}`)
  }
}

async function handlePaymentEvent(mpPaymentId: string) {
  let mpPayment
  try {
    mpPayment = await getMpPayment(mpPaymentId)
  } catch (err) {
    console.error(`[Webhook] Failed to fetch MP payment ${mpPaymentId}:`, err)
    return
  }

  if (!mpPayment) {
    console.warn(`[Webhook] MP payment ${mpPaymentId} not found from API`)
    return
  }

  console.info(`[Webhook] MP payment ${mpPaymentId} status=${mpPayment.status} detail=${mpPayment.status_detail} ext_ref=${mpPayment.external_reference}`)

  // Try multiple matching strategies:
  // 1. By gateway_reference (MP payment ID stored on our payment)
  // 2. By external_reference (our payment ID stored in MP preference)
  // 3. By preference ID in gateway_reference (for sandbox fallback)
  let payment = await prisma.payment.findFirst({
    where: {
      OR: [
        { gateway_reference: mpPayment.id },
        ...(mpPayment.external_reference ? [{ id: mpPayment.external_reference }] : []),
        { gateway_reference: { contains: String(mpPayment.id) } },
      ],
    },
    include: { settlements: true },
  })

  if (!payment) {
    console.warn(`[Webhook] Local payment not found for MP payment ${mpPayment.id} (ext_ref=${mpPayment.external_reference})`)
    console.debug('[Webhook] Searching all pending payments with same approximate amount...')
    // Fallback: try matching by amount and status for recently created pending payments
    const recentPending = await prisma.payment.findMany({
      where: {
        status: 'pending',
        gateway_reference: null,
        created_at: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // last hour
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    })
    if (recentPending.length > 0) {
      console.debug(`[Webhook] Found ${recentPending.length} recent pending payments without gateway_reference:`, recentPending.map(p => p.id))
    }
    return
  }

  console.info(`[Webhook] Found local payment ${payment.id} status=${payment.status} -> MP status=${mpPayment.status}`)

  const mpStatus = mpPayment.status

  if (mpStatus === 'approved' && payment.status === 'pending') {
    const method = mapPaymentMethod(mpPayment.payment_method_id)
    const cardLast4 = mpPayment.card?.last_four_digits || null

    console.info(`[Webhook] Approving payment ${payment.id} method=${method} card_last4=${cardLast4}`)

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'approved',
        method,
        card_last4: cardLast4,
        gateway_reference: mpPayment.id,
        approved_at: mpPayment.date_approved ? new Date(mpPayment.date_approved) : new Date(),
      },
    })

    await prisma.paymentStatusHistory.create({
      data: {
        payment_id: payment.id,
        from_status: 'pending',
        to_status: 'approved',
        changed_by: 'system',
        reason: 'MP payment approved',
      },
    })

    try {
      await notifyBuyerOrderStatus(payment.order_id, 'paid', payment.id)
      console.info(`[Webhook] Notified buyer of payment ${payment.id} status=paid`)
    } catch (err) {
      console.error(`[Webhook] Failed to notify buyer for payment ${payment.id}:`, err)
    }

    const itemsSummary = payment.items_summary as Array<{
      seller_profile_id: string
      subtotal_cents: number
      shipping_cost_cents: number
      order_seller_group_id?: string
      buyer_profile_id?: string
      buyer_clerk_user_id?: string
      items?: Array<{
        product_id: string
        product_name_snapshot: string
        unit_price_cents: number
        quantity: number
      }>
      shipping_address_snapshot?: Record<string, unknown>
      currency?: string
    }> | null

    if (itemsSummary && Array.isArray(itemsSummary)) {
      for (const item of itemsSummary) {
        const totalCents = item.subtotal_cents + item.shipping_cost_cents

        try {
          await createSellerSalesOrder(item.seller_profile_id, {
            order_id: payment.order_id,
            order_seller_group_id: item.order_seller_group_id || `osg_${payment.id}_${item.seller_profile_id}`,
            buyer_profile_id: item.buyer_profile_id || payment.buyer_profile_id,
            buyer_clerk_user_id: item.buyer_clerk_user_id || payment.buyer_clerk_user_id || '',
            items: item.items || [],
            items_subtotal_cents: item.subtotal_cents,
            shipping_cost_cents: item.shipping_cost_cents,
            total_cents: totalCents,
            currency: item.currency || payment.currency || 'ARS',
            shipping_address_snapshot: item.shipping_address_snapshot || {},
            payment_id: payment.id,
          })
          console.info(`[Webhook] Created sales order for seller ${item.seller_profile_id}`)
        } catch (err) {
          console.error(`[Webhook] Failed to create sales order for seller ${item.seller_profile_id}:`, err)
        }
      }
    } else {
      console.warn(`[Webhook] Payment ${payment.id} approved but no items_summary found`)
    }
  }

  if (mpStatus === 'rejected' && payment.status === 'pending') {
    console.info(`[Webhook] Rejecting payment ${payment.id}`)

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'rejected', rejected_at: new Date() },
    })

    await prisma.paymentStatusHistory.create({
      data: {
        payment_id: payment.id,
        from_status: 'pending',
        to_status: 'rejected',
        changed_by: 'system',
        reason: 'MP payment rejected',
      },
    })

    try {
      await notifyBuyerOrderStatus(payment.order_id, 'payment_failed', payment.id)
      console.info(`[Webhook] Notified buyer of rejected payment ${payment.id}`)
    } catch (err) {
      console.error(`[Webhook] Failed to notify buyer of rejected payment ${payment.id}:`, err)
    }
  }

  if (mpStatus === 'refunded' && payment.status === 'approved') {
    console.info(`[Webhook] Refunding payment ${payment.id}`)

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded' },
    })

    await prisma.paymentStatusHistory.create({
      data: {
        payment_id: payment.id,
        from_status: 'approved',
        to_status: 'refunded',
        changed_by: 'system',
        reason: 'MP payment refunded',
      },
    })

    try {
      await notifyBuyerOrderStatus(payment.order_id, 'refunded', payment.id)
      console.info(`[Webhook] Notified buyer of refunded payment ${payment.id}`)
    } catch (err) {
      console.error(`[Webhook] Failed to notify buyer of refunded payment ${payment.id}:`, err)
    }
  }

  if (mpStatus === 'cancelled' && payment.status === 'pending') {
    console.info(`[Webhook] Cancelling payment ${payment.id}`)

    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'cancelled', cancelled_at: new Date() },
    })

    await prisma.paymentStatusHistory.create({
      data: {
        payment_id: payment.id,
        from_status: 'pending',
        to_status: 'cancelled',
        changed_by: 'system',
        reason: 'MP payment cancelled',
      },
    })

    try {
      await notifyBuyerOrderStatus(payment.order_id, 'cancelled', payment.id)
    } catch (err) {
      console.error(`[Webhook] Failed to notify buyer of cancelled payment ${payment.id}:`, err)
    }
  }
}

function mapPaymentMethod(mpMethodId: string): PaymentMethod | null {
  const methodMap: Record<string, PaymentMethod | undefined> = {
    credit_card: 'credit_card',
    debit_card: 'debit_card',
    account_money: 'account_money',
    pix: 'pix',
    bank_transfer: 'bank_transfer',
    ticket: 'bank_transfer',
  }
  return methodMap[mpMethodId] ?? null
}
