import { prisma } from '@/lib/prisma'
import { processMpWebhookEventCore } from './mp-webhook-processor'
import { enqueueJob } from './job-queue.service'
import { notifyBuyerOrderStatus, createSellerSalesOrder } from './inter-app-client.service'

interface JobRecord {
  id: string
  mp_event_id: string
  job_type: string
  payload: any
  attempts: number
  max_attempts: number
}

interface HandlerResult {
  success: boolean
  error?: string
}

export async function handleProcessWebhook(job: JobRecord): Promise<HandlerResult> {
  const result = await processMpWebhookEventCore(job.mp_event_id)

  if (result?.transitionedToApproved) {
    // Atomic claim: only the first concurrent process_webhook for this payment wins
    const claim = await prisma.payment.updateMany({
      where: { id: result.paymentId, notified_at: null },
      data: { notified_at: new Date() },
    })
    if (claim.count === 0) {
      console.log(`[JobHandler] Notifications already claimed for payment ${result.paymentId}, skipping`)
      return { success: true }
    }

    console.log(`[JobHandler] Payment ${result.paymentId} approved, enqueueing notification jobs`)

    const basePayload = {
      mp_event_id: job.mp_event_id,
      payment_id: result.paymentId,
      order_id: result.orderId,
      buyer_profile_id: result.buyerProfileId,
      buyer_clerk_user_id: result.buyerClerkUserId,
      currency: result.currency,
    }

    // Notification enqueue is best-effort — each send_notification job retries independently.
    // If enqueue fails here (DB issue), the process_webhook job still completes and the
    // next merchant_order webhook retry will trigger a new process_webhook which will
    // re-attempt the claim (notified_at already set → claim fails → skip)
    try {
      await enqueueJob(`${job.mp_event_id}:buyer`, 'send_notification', {
        ...basePayload,
        recipient_type: 'buyer',
      })

      if (result.itemsSummary && Array.isArray(result.itemsSummary)) {
        for (const seller of result.itemsSummary) {
          const sellerItems = (seller.items as Array<Record<string, any>>) || []
          await enqueueJob(`${job.mp_event_id}:seller:${seller.seller_profile_id}`, 'send_notification', {
            ...basePayload,
            recipient_type: 'seller',
            seller_profile_id: seller.seller_profile_id as string,
            order_seller_group_id: seller.order_seller_group_id as string,
            shipping_quote_id: seller.shipping_quote_id as string,
            items: sellerItems.map((it: any) => ({
              product_id: it.product_id,
              product_name_snapshot: it.product_name_snapshot,
              unit_price_cents: it.unit_price_cents,
              quantity: it.quantity,
            })),
            items_subtotal_cents: seller.subtotal_cents as number,
            shipping_cost_cents: seller.shipping_cost_cents as number,
            total_cents: (seller.subtotal_cents as number) + (seller.shipping_cost_cents as number),
          })
        }
      }
    } catch (enqueueErr) {
      const errMsg = enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr)
      console.error(`[JobHandler] Failed to enqueue notification jobs for payment ${result.paymentId}: ${errMsg}`)
    }
  }

  return { success: true }
}

export async function handleSendNotification(job: JobRecord): Promise<HandlerResult> {
  const p = job.payload
  try {
    if (p.recipient_type === 'buyer') {
      await notifyBuyerOrderStatus(p.order_id, 'paid', p.payment_id)
      console.log(`[JobHandler] Buyer notified for payment ${p.payment_id}`)
    } else if (p.recipient_type === 'seller') {
      await createSellerSalesOrder(p.seller_profile_id, {
        order_id: p.order_id,
        order_seller_group_id: p.order_seller_group_id,
        buyer_profile_id: p.buyer_profile_id,
        buyer_clerk_user_id: p.buyer_clerk_user_id,
        items: p.items || [],
        items_subtotal_cents: p.items_subtotal_cents,
        shipping_cost_cents: p.shipping_cost_cents,
        total_cents: p.total_cents,
        currency: p.currency,
        shipping_address_snapshot: {},
        shipping_quote_id: p.shipping_quote_id,
        payment_id: p.payment_id,
      })
      console.log(`[JobHandler] Seller ${p.seller_profile_id} notified for payment ${p.payment_id}`)
    } else {
      console.warn(`[JobHandler] Unknown recipient_type=${p.recipient_type} for payment ${p.payment_id}`)
    }
    return { success: true }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[JobHandler] Notification failed for payment ${p.payment_id} recipient=${p.recipient_type}: ${errMsg}`)
    return { success: false, error: errMsg }
  }
}

export default { handleProcessWebhook, handleSendNotification }
