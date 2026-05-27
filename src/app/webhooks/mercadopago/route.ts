import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateMercadoPagoSignature } from '@/lib/webhook-signature'
import { getPayment as getMpPayment } from '@/services/mercado-pago.service'
import { notifyBuyerOrderStatus, createSellerSalesOrder } from '@/services/inter-app-client.service'
import { handleRouteError, errorResponse } from '@/lib/errors'
import type { PaymentMethod } from '@/generated/prisma/client'

async function getBodyAsString(req: Request): Promise<string> {
  const clone = req.clone()
  return clone.text()
}

async function getBodyAsJson(req: Request): Promise<unknown> {
  const clone = req.clone()
  return clone.json()
}

export async function POST(req: Request) {
  try {
    const rawBody = await getBodyAsString(req)
    const payload = JSON.parse(rawBody)
    const signature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')

    const signatureValid = validateMercadoPagoSignature(rawBody, signature, xRequestId)

    const webhookEvent = await prisma.mpWebhookEvent.create({
      data: {
        mp_event_id: payload?.id ? String(payload.id) : `evt_${Date.now()}`,
        event_type: payload?.type || 'unknown',
        payload,
        signature_valid: signatureValid,
        status: signatureValid ? 'received' : 'received',
      },
    })

    if (!signatureValid) {
      console.warn('Webhook received with invalid signature:', payload?.id)
      return NextResponse.json({ received: true, warning: 'Invalid signature' }, { status: 200 })
    }

    await processWebhookEvent(payload)

    await prisma.mpWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: 'processed', processed_at: new Date() },
    })

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('Webhook processing failed:', err)
    return errorResponse('INTERNAL_ERROR', 'Webhook processing failed', 500)
  }
}

async function processWebhookEvent(payload: any) {
  const eventType = payload?.type || ''
  const resource = payload?.data?.id

  if (!resource) return

  if (eventType.includes('payment')) {
    await handlePaymentEvent(resource)
  }
}

async function handlePaymentEvent(mpPaymentId: string) {
  const mpPayment = await getMpPayment(mpPaymentId)
  if (!mpPayment) {
    console.warn(`MP payment ${mpPaymentId} not found`)
    return
  }

  const payment = await prisma.payment.findFirst({
    where: { gateway_reference: mpPayment.id },
    include: { settlements: true },
  })

  if (!payment) {
    console.warn(`Local payment not found for MP reference ${mpPayment.id}`)
    return
  }

  const mpStatus = mpPayment.status

  if (mpStatus === 'approved' && payment.status === 'pending') {
    const method = mapPaymentMethod(mpPayment.payment_method_id)
    const cardLast4 = mpPayment.card?.last_four_digits || null

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

    await notifyBuyerOrderStatus(payment.order_id, 'paid', payment.id)

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
        } catch (err) {
          console.error(`Failed to create sales order for seller ${item.seller_profile_id}:`, err)
        }
      }

    }
  }

  if (mpStatus === 'rejected' && payment.status === 'pending') {
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
    } catch (err) {
      console.error('Failed to notify buyer of rejected payment:', err)
    }
  }

  if (mpStatus === 'refunded' && payment.status === 'approved') {
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
    } catch (err) {
      console.error('Failed to notify buyer of refunded payment:', err)
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
