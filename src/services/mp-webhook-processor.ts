import { prisma } from '@/lib/prisma'
import mpService from './mercado-pago.service'

function mapMpStatusToPaymentStatus(status?: string) {
  const s = (status || '').toString().toLowerCase()
  if (s === 'approved') return 'approved'
  if (s === 'cancelled' || s === 'cancelled_by_user' || s === 'cancelled_by_seller') return 'cancelled'
  if (s === 'refunded' || s === 'charged_back') return 'refunded'
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
 * Processor: enrich event, reconcile with Payment model, create attempt/receipt/history.
 * This is intentionally defensive and best-effort — it logs but avoids throwing.
 */
export async function processMpWebhookEvent(mpEventId: string) {
  try {
    const evt = await prisma.mpWebhookEvent.findUnique({ where: { mp_event_id: mpEventId } })
    if (!evt) return

    if (evt.status !== 'received') return

    await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'processing' } })

    const payload: any = evt.payload ?? null
    const dataId = payload?.data?.id || payload?.id || null

    if (!dataId) {
      await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'processed', processed_at: new Date() } })
      return
    }

    let mpDetails: any = null
    try {
      mpDetails = await mpService.fetchPaymentDetails(dataId)
    } catch (innerErr: any) {
      console.error('[MP Processor] Failed fetching MP details for', dataId, innerErr?.message || innerErr)
      await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'failed', last_error: String(innerErr?.message || innerErr) } })
      return
    }

    // Enrich stored payload
    const newPayload = { original: payload, mp_details: mpDetails }

    // Attempt to locate local Payment record
    let payment: any = null

    const externalRef = mpDetails.external_reference || mpDetails.external_reference_id || mpDetails.externalReference || mpDetails.order?.external_reference
    if (externalRef) {
      try {
        payment = await prisma.payment.findUnique({ where: { id: externalRef } })
      } catch {}
    }

    // Try via preference id stored in the initial PaymentAttempt.response_payload
    if (!payment && mpDetails.preference_id) {
      try {
        const attempt = await prisma.paymentAttempt.findFirst({
          where: { response_payload: { path: ['id'], equals: mpDetails.preference_id } },
          orderBy: { created_at: 'desc' },
        })
        if (attempt) payment = await prisma.payment.findUnique({ where: { id: attempt.payment_id } })
      } catch {}
    }

    // Last resort: try finding a paymentAttempt that contains the MP payment id
    if (!payment) {
      try {
        const attempt2 = await prisma.paymentAttempt.findFirst({
          where: { response_payload: { path: ['id'], equals: dataId } },
          orderBy: { created_at: 'desc' },
        })
        if (attempt2) payment = await prisma.payment.findUnique({ where: { id: attempt2.payment_id } })
      } catch {}
    }

    // Compute statuses and map fields
    const mpStatus = (mpDetails.status || mpDetails.transaction_status || mpDetails.collection_status || '').toString()
    const paymentStatus = mapMpStatusToPaymentStatus(mpStatus)
    const attemptStatus = mapMpStatusToAttemptStatus(mpStatus)

    // Create an audit PaymentAttempt representing this notification
    try {
      let lastAttemptNumber = 0
      if (payment) {
        const last = await prisma.paymentAttempt.findFirst({ where: { payment_id: payment.id }, orderBy: { created_at: 'desc' } })
        lastAttemptNumber = last ? last.attempt_number : 0
      }

      await prisma.paymentAttempt.create({
        data: {
          payment_id: payment ? payment.id : undefined,
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

    // Update payment record if found
    if (payment) {
      try {
        const updateData: any = { gateway_reference: mpDetails.id, method: mapPaymentMethod(mpDetails.payment_method_id) }

        const lastCard4 = mpDetails.card?.last_four_digits || mpDetails.card?.last_four || mpDetails.last_four_digits || mpDetails.last_four
        if (lastCard4) updateData.card_last4 = String(lastCard4)

        // Set timestamps based on status
        if (paymentStatus === 'approved') {
          updateData.status = 'approved'
          updateData.approved_at = mpDetails.date_approved ? new Date(mpDetails.date_approved) : new Date()
        } else if (paymentStatus === 'cancelled') {
          updateData.status = 'cancelled'
          updateData.cancelled_at = new Date()
        } else if (paymentStatus === 'refunded') {
          updateData.status = 'refunded'
        } else if (paymentStatus === 'pending') {
          updateData.status = 'pending'
        }

        await prisma.payment.update({ where: { id: payment.id }, data: updateData })

        // Add status history
        try {
          await prisma.paymentStatusHistory.create({ data: { payment_id: payment.id, from_status: payment.status, to_status: updateData.status, changed_by: 'mercadopago-webhook' } })
        } catch {}

        // Create receipt if approved and we have an amount
        if (paymentStatus === 'approved') {
          try {
            const amount = (mpDetails.transaction_amount || mpDetails.transaction_amount_received || mpDetails.total_paid_amount || mpDetails.paid_amount || 0)
            const amountCents = Math.round(Number(amount || 0) * 100)
            const receiptUrl = mpDetails.receipt?.url || mpDetails.transaction_details?.external_resource_url || null
            await prisma.receipt.create({ data: { payment_id: payment.id, receipt_number: String(mpDetails.id), receipt_url: receiptUrl || '', amount_cents: amountCents, issued_at: mpDetails.date_approved ? new Date(mpDetails.date_approved) : new Date() } })
          } catch (rcErr) {
            console.error('[MP Processor] Failed creating receipt', rcErr)
          }
        }
      } catch (pErr) {
        console.error('[MP Processor] Failed updating payment', pErr)
      }
    }

    // Finally mark webhook event processed
    await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { payload: newPayload as any, status: 'processed', processed_at: new Date() } })
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[MP Processor] Unexpected error processing event', mpEventId, errMsg)
    try {
      await prisma.mpWebhookEvent.update({ where: { mp_event_id: mpEventId }, data: { status: 'failed', last_error: errMsg } })
    } catch {}
  }
}

export default { processMpWebhookEvent }
