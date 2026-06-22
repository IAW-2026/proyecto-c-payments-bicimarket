import { prisma } from '@/lib/prisma'
import { validatePaymentTransition } from '@/lib/state-machines/payment'
import mpService from './mercado-pago.service'

export type WebhookProcessResult = {
  paymentId: string
  orderId: string
  transitionedToApproved: boolean
  buyerProfileId: string
  buyerClerkUserId: string
  currency: string
  itemsSummary: Array<Record<string, any>> | null
} | null

function mapMpStatusToPaymentStatus(status?: string) {
  const s = (status || '').toString().toLowerCase()
  if (s === 'approved') return 'approved'
  if (s === 'cancelled' || s === 'cancelled_by_user' || s === 'cancelled_by_seller') return 'cancelled'
  if (s === 'refunded' || s === 'charged_back') return 'refunded'
  if (s === 'rejected') return 'rejected'
  if (s === 'in_process' || s === 'pending') return 'pending'
  return 'pending'
}

function mapMpStatusToAttemptStatus(status?: string) {
  const s = (status || '').toString().toLowerCase()
  if (s === 'approved') return 'approved'
  if (s === 'cancelled' || s === 'refunded' || s === 'rejected') return 'cancelled'
  if (s === 'in_process' || s === 'pending') return 'pending'
  return 'pending'
}

function mapPaymentMethod(mpMethod?: string) {
  if (!mpMethod) return undefined
  const m = mpMethod.toString().toLowerCase()
  if (m.includes('credit')) return 'credit_card'
  if (m.includes('debit')) return 'debit_card'
  if (m === 'account_money' || m.includes('account')) return 'account_money'
  if (m === 'pix') return 'pix'
  if (m.includes('bank_transfer') || m.includes('bank')) return 'bank_transfer'
  return undefined
}

/**
 * Core processor — no cleanup, no notifications, returns result for job chaining.
 * This is intentionally defensive and best-effort — it logs but avoids throwing.
 */
export async function processMpWebhookEventCore(mpEventId: string): Promise<WebhookProcessResult> {
  console.log(`[MP Flow] processMpWebhookEventCore called mpEventId=${mpEventId}`)
  try {
    const evt = await prisma.mpWebhookEvent.findUnique({ where: { mp_event_id: mpEventId } })
    if (!evt) {
      console.log(`[MP Flow] Event not found in DB mpEventId=${mpEventId}`)
      return null
    }

    console.log(`[MP Flow] Event found status=${evt.status} mpEventId=${mpEventId}`)
    if (evt.status !== 'received') {
      console.log(`[MP Flow] Skipping — status is ${evt.status}, not 'received' mpEventId=${mpEventId}`)
      return null
    }

    console.log(`[MP Flow] Setting status to 'processing' mpEventId=${mpEventId}`)
    await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'processing' } })

    const payload: any = evt.payload ?? null
    const rawId = payload?.data?.id ?? payload?.id ?? null
    const dataId = rawId != null ? String(rawId) : null

    if (!dataId) {
      await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'processed', processed_at: new Date() } })
      return null
    }

    console.log(`[MP Flow] Fetching MP payment details for dataId=${dataId}`)
    let mpDetails: any = null
    try {
      mpDetails = await mpService.fetchPaymentDetails(dataId)
      console.log(`[MP Flow] MP details fetched dataId=${dataId} mpStatus=${mpDetails?.status} external_ref=${mpDetails?.external_reference}`)
    } catch (innerErr: any) {
      const errMsg = innerErr?.message || String(innerErr)
      const is404 = innerErr?.response?.status === 404
      const mpApiMsg = innerErr?.response?.data?.message || ''
      console.log(`[MP Flow] MP details fetch FAILED dataId=${dataId} is404=${is404} error="${errMsg}"`)
      if (is404) {
        console.warn(`[MP Processor] MP payment not found for ${dataId}: status=404 apiMessage="${mpApiMsg}" error="${errMsg}"`)
      } else {
        console.error(`[MP Processor] Failed fetching MP details for ${dataId}: status=${innerErr?.response?.status} apiMessage="${mpApiMsg}" error="${errMsg}"`)
      }
      await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'failed', last_error: errMsg } })
      console.log(`[MP Flow] Event marked as 'failed' mpEventId=${mpEventId}`)
      return null
    }

    const newPayload = { original: payload, mp_details: mpDetails }

    // Attempt to locate local Payment record
    let payment: any = null
    const matchAttempts: string[] = []

    const externalRef = mpDetails.external_reference || mpDetails.external_reference_id || mpDetails.externalReference || mpDetails.order?.external_reference
    if (externalRef) {
      try {
        payment = await prisma.payment.findUnique({ where: { id: externalRef } })
        matchAttempts.push(`external_reference=${externalRef} found=${!!payment}`)
      } catch (e) {
        matchAttempts.push(`external_reference=${externalRef} error=${e instanceof Error ? e.message : e}`)
      }
    }

    if (!payment && mpDetails.preference_id) {
      try {
        const attempt = await prisma.paymentAttempt.findFirst({
          where: { response_payload: { path: ['id'], equals: mpDetails.preference_id } },
          orderBy: { created_at: 'desc' },
        })
        if (attempt) payment = await prisma.payment.findUnique({ where: { id: attempt.payment_id } })
        matchAttempts.push(`preference_id=${mpDetails.preference_id} found=${!!payment}`)
      } catch (e) {
        matchAttempts.push(`preference_id=${mpDetails.preference_id} error=${e instanceof Error ? e.message : e}`)
      }
    }

    if (!payment) {
      try {
        const attempt2 = await prisma.paymentAttempt.findFirst({
          where: { response_payload: { path: ['id'], equals: dataId } },
          orderBy: { created_at: 'desc' },
        })
        if (attempt2) payment = await prisma.payment.findUnique({ where: { id: attempt2.payment_id } })
        matchAttempts.push(`mp_payment_id=${dataId} found=${!!payment}`)
      } catch (e) {
        matchAttempts.push(`mp_payment_id=${dataId} error=${e instanceof Error ? e.message : e}`)
      }
    }

    if (!payment) {
      console.log(`[MP Flow] Payment NOT matched for dataId=${dataId}. Strategies: [${matchAttempts.join(', ')}]`)
      console.error(`[MP Processor] Could not match payment for dataId=${dataId} mpEventId=${mpEventId}. Strategies: [${matchAttempts.join(', ')}]`)
    } else {
      console.log(`[MP Flow] Payment matched: ${payment.id} current_status=${payment.status}`)
    }

    const mpStatus = (mpDetails.status || mpDetails.transaction_status || mpDetails.collection_status || '').toString()
    const paymentStatus = mapMpStatusToPaymentStatus(mpStatus)
    const attemptStatus = mapMpStatusToAttemptStatus(mpStatus)
    console.log(`[MP Flow] Status mapping: mpStatus=${mpStatus} → paymentStatus=${paymentStatus} attemptStatus=${attemptStatus}`)

    // Create audit PaymentAttempt
    if (payment) {
      try {
        const last = await prisma.paymentAttempt.findFirst({ where: { payment_id: payment.id }, orderBy: { created_at: 'desc' } })
        const lastAttemptNumber = last ? last.attempt_number : 0
        await prisma.paymentAttempt.create({
          data: {
            payment_id: payment.id,
            attempt_number: lastAttemptNumber + 1,
            provider: 'mercadopago',
            status: attemptStatus as any,
            request_payload: { webhook_payload: payload } as any,
            response_payload: mpDetails as any,
          },
        })
      } catch (attErr) {
        console.error('[MP Processor] Failed creating PaymentAttempt audit', attErr)
      }
    }

    // Update payment record
    if (payment) {
      try {
        const updateData: any = { gateway_reference: String(mpDetails.id), method: mapPaymentMethod(mpDetails.payment_method?.type || mpDetails.payment_method_id) }

        const lastCard4 = mpDetails.card?.last_four_digits || mpDetails.card?.last_four || mpDetails.last_four_digits || mpDetails.last_four
        if (lastCard4) updateData.card_last4 = String(lastCard4)

        const statusSame = paymentStatus === payment.status
        console.log(`[MP Flow] Payment ${payment.id}: current=${payment.status} new=${paymentStatus} statusSame=${statusSame}`)
        if (!statusSame) {
          if (paymentStatus === 'approved') {
            updateData.status = 'approved'
            updateData.approved_at = mpDetails.date_approved ? new Date(mpDetails.date_approved) : new Date()
          } else if (paymentStatus === 'cancelled') {
            updateData.status = 'cancelled'
            updateData.cancelled_at = new Date()
          } else if (paymentStatus === 'refunded') {
            updateData.status = 'refunded'
          } else if (paymentStatus === 'rejected') {
            updateData.status = 'rejected'
          }

          try {
            validatePaymentTransition(payment.status as any, updateData.status as any)
            console.log(`[MP Flow] Transition valid: ${payment.status} → ${updateData.status}`)
          } catch (transitionErr) {
            const errMsg = transitionErr instanceof Error ? transitionErr.message : String(transitionErr)
            console.log(`[MP Flow] Invalid transition: ${payment.status} → ${updateData.status} — ${errMsg}`)
            console.warn(`[MP Processor] Invalid transition: ${payment.status} → ${updateData.status} for payment ${payment.id}. Marking event failed.`)
            await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'failed', last_error: errMsg } })
            console.log(`[MP Flow] Event marked as 'failed' (bad transition) mpEventId=${mpEventId}`)
            return null
          }
        }

        console.log(`[MP Flow] Updating payment ${payment.id} with`, JSON.stringify(updateData))
        await prisma.payment.update({ where: { id: payment.id }, data: updateData })
        console.log(`[MP Flow] Payment ${payment.id} updated successfully`)

        if (!statusSame) {
          try {
            await prisma.paymentStatusHistory.create({ data: { payment_id: payment.id, from_status: payment.status, to_status: updateData.status, changed_by: 'mercadopago-webhook' } })
          } catch {}
        }

        // Create receipt if approved
        if (paymentStatus === 'approved') {
          try {
            const amount = (mpDetails.transaction_amount || mpDetails.transaction_amount_received || mpDetails.total_paid_amount || mpDetails.paid_amount || 0)
            const amountCents = Math.round(Number(amount || 0) * 100)
            const receiptUrl = mpDetails.receipt?.url || mpDetails.transaction_details?.external_resource_url || null
            await prisma.receipt.create({ data: { payment_id: payment.id, receipt_number: String(mpDetails.id), receipt_url: receiptUrl || '', amount_cents: amountCents, issued_at: mpDetails.date_approved ? new Date(mpDetails.date_approved) : new Date() } })
            console.log(`[MP Flow] Receipt created for payment ${payment.id}`)
          } catch (rcErr) {
            console.error('[MP Processor] Failed creating receipt', rcErr)
            console.log(`[MP Flow] Receipt creation FAILED for payment ${payment.id}`)
          }
        }
      } catch (pErr) {
        console.error('[MP Processor] Failed updating payment', pErr)
      }
    }

    // Mark event processed
    console.log(`[MP Flow] Marking event as 'processed' mpEventId=${mpEventId}`)
    await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { payload: newPayload as any, status: 'processed', processed_at: new Date() } })
    console.log(`[MP Flow] Event marked 'processed' successfully mpEventId=${mpEventId}`)

    // Return result for job chaining
    if (payment && paymentStatus === 'approved') {
      const wasAlreadyApproved = payment.status === 'approved'
      return {
        paymentId: payment.id,
        orderId: payment.order_id,
        transitionedToApproved: !wasAlreadyApproved,
        buyerProfileId: payment.buyer_profile_id,
        buyerClerkUserId: payment.buyer_clerk_user_id,
        currency: payment.currency,
        itemsSummary: payment.items_summary as Array<Record<string, any>> | null,
      }
    }

    return null
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[MP Flow] Unexpected error processing event ${mpEventId}: ${errMsg}`)
    try {
      await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'failed', last_error: errMsg } })
      console.log(`[MP Flow] Event marked as 'failed' (unexpected error) mpEventId=${mpEventId}`)
    } catch {}
    return null
  }
}

/**
 * Backward-compatible wrapper that ignores the return value.
 * Used by direct callers (if any) that don't need job chaining.
 */
export async function processMpWebhookEvent(mpEventId: string): Promise<void> {
  await processMpWebhookEventCore(mpEventId)
}

export default { processMpWebhookEvent, processMpWebhookEventCore }
