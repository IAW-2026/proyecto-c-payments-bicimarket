import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /webhooks/mercadopago
export async function POST(req: Request) {
  try {
    const payload = await req.json()
    // TODO: validate signature using MP_WEBHOOK_KEY
    // Minimal log saving
    await prisma.mpWebhookEvent.create({ data: {
      mp_event_id: payload?.id ? String(payload.id) : String(Date.now()),
      event_type: payload?.type || 'unknown',
      payload: payload,
      signature_valid: false
    }})

    // Return 200 quickly
    return NextResponse.json({ received: true })
  } catch (err) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } }, { status: 500 })
  }
}
