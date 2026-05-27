import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createPaymentSchema } from '@/schemas/payment'
import { createCheckoutPreference, MercadoPagoError } from '@/services/mercado-pago.service'
import { handleRouteError, badRequest } from '@/lib/errors'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const parsed = createPaymentSchema.safeParse(body)
    if (!parsed.success) {
      return badRequest('Validation failed', {
        errors: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      })
    }

    const validated = parsed.data
    const idempotencyKey = crypto.randomUUID()

    if (validated.items_summary) {
      const summedAmount = validated.items_summary.reduce((sum, item) => {
        return sum + item.subtotal_cents + item.shipping_cost_cents
      }, 0)

      if (summedAmount !== validated.amount_cents) {
        return badRequest(`items_summary total (${summedAmount}) does not match amount_cents (${validated.amount_cents})`, {
          expected: validated.amount_cents,
          received: summedAmount,
        })
      }
    }

    const payment = await prisma.payment.create({
      data: {
        order_id: validated.order_id,
        buyer_clerk_user_id: validated.buyer_clerk_user_id,
        buyer_profile_id: validated.buyer_profile_id,
        amount_cents: validated.amount_cents,
        currency: validated.currency || 'ARS',
        idempotency_key: idempotencyKey,
        items_summary: validated.items_summary ?? undefined,
        status: 'pending',
      },
    })

    let checkoutUrl: string | null = null
    let gatewayReference: string | null = null

    try {
      const pref = await createCheckoutPreference({
        amount_cents: payment.amount_cents,
        external_reference: payment.id,
        buyer_email: validated.buyer_email,
        items: validated.items_summary?.map((item) => ({
          title: `Seller ${item.seller_profile_id}`,
          quantity: 1,
          unit_price_cents: item.subtotal_cents + item.shipping_cost_cents,
        })) || [],
        return_urls: validated.return_urls,
      })

      checkoutUrl = pref.init_point
      gatewayReference = pref.id

      await prisma.payment.update({
        where: { id: payment.id },
        data: { gateway_reference: gatewayReference },
      })
    } catch (mpErr) {
      if (mpErr instanceof MercadoPagoError) {
        console.error(`[Payments] MP preference creation failed: ${mpErr.message}`)
      } else {
        console.error('[Payments] Failed to create MP checkout preference:', mpErr)
      }
    }

    return NextResponse.json({
      data: {
        ...payment,
        checkout_url: checkoutUrl,
        gateway_reference: gatewayReference,
      },
    }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'creating test payment')
  }
}
