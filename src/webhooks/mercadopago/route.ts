import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// POST /webhooks/mercadopago - webhook from Mercado Pago
export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const signature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')

    // TODO: Implement proper MP signature validation
    // For now, we'll validate that signature exists but mark as unvalidated
    const signatureValid = validateMercadoPagoSignature(payload, signature, xRequestId)

    // Create webhook event record
    const webhookEvent = await prisma.mpWebhookEvent.create({ data: {
      mp_event_id: payload?.id ? String(payload.id) : String(Date.now()),
      event_type: payload?.type || 'unknown',
      payload: payload,
      signature_valid: signatureValid,
      status: signatureValid ? 'received' : 'received' // Still receive but mark as invalid
    }})

    // Only process if signature is valid
    if (!signatureValid) {
      console.warn('Webhook received with invalid signature:', payload?.id)
      // Return 200 anyway to not retry (Mercado Pago would keep retrying)
      return NextResponse.json({ received: true, warning: 'Invalid signature' }, { status: 200 })
    }

    // Process webhook events
    await processWebhookEvent(payload)

    // Update status to processed
    await prisma.mpWebhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: 'processed', processed_at: new Date() }
    })

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error('Webhook processing failed:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } }, { status: 500 })
  }
}

function validateMercadoPagoSignature(payload: any, signature: string | null, xRequestId: string | null): boolean {
  // TODO: Implement proper signature validation
  // MP sends: x-signature header with format: "ts=1234567890,v1=abc123..."
  // We need to: 
  // 1. Extract timestamp and signature from header
  // 2. Construct the signed string: "{request_id},{timestamp},{body}"
  // 3. Validate HMAC-SHA256 using MP_WEBHOOK_KEY
  
  if (!signature || !xRequestId) {
    return false
  }

  // Placeholder: just check that both exist
  // In production, implement full HMAC validation
  return signature.length > 0 && xRequestId.length > 0
}

async function processWebhookEvent(payload: any) {
  const eventType = payload?.type || ''

  // Handle payment-related events
  if (eventType.includes('payment')) {
    const resource = payload?.data?.id
    const status = payload?.data?.status

    if (resource) {
      // TODO: Look up payment by gateway_reference = resource
      // If payment.status is pending and new status is approved:
      //   - Update payment.status = approved, payment.approved_at = now
      //   - Call notifyBuyerOrderStatus(payment.order_id, 'paid')
      //   - Call createSellerSalesOrders for each seller group
      // If payment.status is approved and new status is refunded:
      //   - Update payment.status = cancelled
      //   - Create refund record
      
      console.log(`Processing payment event: resource=${resource}, status=${status}`)
    }
  }

  // Handle plan events (unused for now)
  if (eventType.includes('plan')) {
    console.log(`Received plan event: ${eventType}`)
  }
}

