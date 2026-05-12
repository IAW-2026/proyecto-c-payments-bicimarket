# Mercado Pago Integration Guide

## Overview

This guide explains how to implement Mercado Pago integration for the BiciMarket Payments App. Currently, the payment processing is stubbed and ready for MP integration.

---

## 1. Account Setup

### 1.1 Create Mercado Pago Account

1. Go to [https://www.mercadopago.com.ar](https://www.mercadopago.com.ar) (or your country)
2. Sign up and verify your email
3. Complete KYC verification (Know Your Customer)
4. Navigate to **Settings > Credentials** to get:
   - **Access Token** (starts with `APP_USR-`)
   - **Public Key** (for frontend checkout)
   - **Webhook signing key** (for validating incoming webhooks)

### 1.2 Environment Configuration

Add these to your `.env.local`:

```env
# Mercado Pago Credentials
MP_ACCESS_TOKEN=APP_USR-xxxxx
MP_PUBLIC_KEY=APP_USR_PUBLIC-xxxxx
MP_WEBHOOK_SECRET=xxxxx

# Inter-app URLs
BUYER_APP_URL=http://localhost:3001
SELLER_APP_URL=http://localhost:3002
SHIPPING_APP_URL=http://localhost:3003

# Service Tokens
BUYER_TO_PAYMENTS_SERVICE_TOKEN=buyer-secret-token
SELLER_TO_PAYMENTS_SERVICE_TOKEN=seller-secret-token
SHIPPING_TO_PAYMENTS_SERVICE_TOKEN=shipping-secret-token
```

---

## 2. Payment Flow Integration

### 2.1 Create Checkout Preference

When a buyer initiates checkout, create a MP preference:

```typescript
// src/services/mercado-pago.service.ts

import axios from 'axios'

const MP_API_BASE = 'https://api.mercadopago.com'

export async function createCheckoutPreference(payload: {
  order_id: string
  amount_cents: number
  buyer_profile_id: string
  buyer_email: string
}) {
  const response = await axios.post(
    `${MP_API_BASE}/checkout/preferences`,
    {
      external_reference: payload.order_id,
      items: [
        {
          title: `Order ${payload.order_id}`,
          unit_price: payload.amount_cents / 100,
          quantity: 1
        }
      ],
      payer: {
        email: payload.buyer_email
      },
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment/pending`
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/webhooks/mercadopago`
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
      }
    }
  )

  return {
    id: response.data.id,
    init_point: response.data.init_point // Checkout URL
  }
}
```

### 2.2 Update POST /api/v1/payments

Modify the payment creation endpoint to create MP preference:

```typescript
// src/app/api/v1/payments/route.ts (POST section)

export async function POST(req: Request) {
  // ... existing validation ...

  const payment = await prisma.payment.create({
    data: {
      order_id: body.order_id,
      buyer_clerk_user_id: body.buyer_clerk_user_id,
      buyer_profile_id: body.buyer_profile_id,
      amount_cents: body.amount_cents,
      currency: body.currency || 'ARS',
      status: 'pending'
    }
  })

  // ✅ IMPLEMENT: Create MP checkout preference
  try {
    const preference = await createCheckoutPreference({
      order_id: payment.order_id,
      amount_cents: payment.amount_cents,
      buyer_profile_id: payment.buyer_profile_id,
      buyer_email: body.buyer_email // Accept from request
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: { gateway_reference: preference.id }
    })

    return NextResponse.json({
      data: {
        ...payment,
        checkout_url: preference.init_point // Send to buyer for redirect
      }
    }, { status: 201 })
  } catch (err) {
    console.error('MP preference creation failed:', err)
    // Log error but don't block payment creation
    return NextResponse.json({
      data: payment,
      warning: 'MP checkout not available'
    }, { status: 201 })
  }
}
```

---

## 3. Webhook Integration

### 3.1 Webhook Registration

1. In Mercado Pago **Settings > Webhooks**, register:
   - **URL**: `https://your-app.com/webhooks/mercadopago`
   - **Events**: `payment.created`, `payment.updated`

2. Save the **Webhook Signing Key** in env vars

### 3.2 Signature Validation

Mercado Pago sends webhooks with signature for security. Validate before processing:

```typescript
// src/webhooks/mercadopago/route.ts

import crypto from 'crypto'

function validateMercadoPagoSignature(
  body: string,
  signature: string,
  xRequestId: string
): boolean {
  // MP sends signature as: "ts=1234567890,v1=HMAC_SHA256"
  const parts = signature.split(',')
  const ts = parts[0].split('=')[1]
  const v1 = parts[1].split('=')[1]

  // Construct signed string: "request_id.timestamp.body"
  const signedString = `${xRequestId}.${ts}.${body}`

  // Compute HMAC
  const computed = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET!)
    .update(signedString)
    .digest('base64')

  // Compare
  return computed === v1
}

export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('x-signature')
  const xRequestId = req.headers.get('x-request-id')

  if (!validateMercadoPagoSignature(body, signature!, xRequestId!)) {
    console.warn('Invalid webhook signature')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const payload = JSON.parse(body)
  // ✅ Process webhook (see section 3.3)
}
```

### 3.3 Process Payment Events

When webhook is valid, update payment status and trigger outbound calls:

```typescript
// Inside POST /webhooks/mercadopago handler

async function processWebhookEvent(payload: any) {
  const eventType = payload.type // "payment.created" or "payment.updated"
  const resourceId = payload.data.id

  if (!eventType.includes('payment')) return

  // Fetch payment by gateway_reference
  const payment = await prisma.payment.findFirst({
    where: { gateway_reference: String(resourceId) }
  })

  if (!payment) {
    console.warn(`Payment not found for resource ${resourceId}`)
    return
  }

  // Get MP payment details
  const mpPayment = await getMercadoPagoPaymentDetails(resourceId)

  // Update payment status based on MP status
  if (mpPayment.status === 'approved') {
    // ✅ Payment approved - notify buyers and sellers
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'approved',
        approved_at: new Date()
      }
    })

    // Notify Buyer App
    try {
      await notifyBuyerOrderStatus(payment.order_id, 'paid')
    } catch (err) {
      console.error('Failed to notify buyer:', err)
    }

    // Create settlements for each seller (requires order details from Buyer App)
    try {
      const orderDetails = await getOrderDetails(payment.order_id)
      for (const sellerGroup of orderDetails.seller_groups) {
        await createSettlement(payment, sellerGroup)
        await createSellerSalesOrder(sellerGroup.seller_id, { order_id: payment.order_id })
      }
    } catch (err) {
      console.error('Failed to create settlements:', err)
    }
  }

  if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
    // ❌ Payment rejected or cancelled
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'rejected',
        rejected_at: new Date()
      }
    })

    // Notify Buyer App
    try {
      await notifyBuyerOrderStatus(payment.order_id, 'payment_failed')
    } catch (err) {
      console.error('Failed to notify buyer:', err)
    }
  }

  if (mpPayment.status === 'refunded') {
    // 💰 Payment was refunded
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'cancelled' }
    })

    // Create refund record
    await prisma.refund.create({
      data: {
        payment_id: payment.id,
        amount_cents: payment.amount_cents,
        reason: 'manual',
        status: 'approved',
        gateway_reference: mpPayment.refund_id
      }
    })
  }
}

async function getMercadoPagoPaymentDetails(paymentId: string) {
  const response = await axios.get(
    `${MP_API_BASE}/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
      }
    }
  )
  return response.data
}
```

---

## 4. Refund Processing

### 4.1 POST /api/v1/payments/{paymentId}/refund

Implement refund by calling MP API:

```typescript
// src/app/api/v1/payments/[paymentId]/refund/route.ts (POST section)

export async function POST(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })

  if (payment.status !== 'approved') {
    return NextResponse.json(
      { error: { code: 'INVALID_STATE', message: 'Can only refund approved payments' } },
      { status: 400 }
    )
  }

  const body = await req.json()
  const { amount_cents, reason } = body

  // ✅ IMPLEMENT: Call MP refund API
  try {
    const refundResponse = await axios.post(
      `${MP_API_BASE}/v1/payments/${payment.gateway_reference}/refunds`,
      { amount: amount_cents / 100 },
      { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
    )

    const refund = await prisma.refund.create({
      data: {
        payment_id: paymentId,
        amount_cents,
        reason,
        status: 'approved',
        gateway_reference: refundResponse.data.id
      }
    })

    return NextResponse.json({ data: refund }, { status: 201 })
  } catch (err: any) {
    console.error('Refund failed:', err.response?.data)
    return NextResponse.json(
      { error: { code: 'REFUND_FAILED', message: 'MP refund API error' } },
      { status: 400 }
    )
  }
}
```

---

## 5. Payout / Transfer Implementation

### 5.1 POST /api/v1/payouts

Create transfers to seller accounts:

```typescript
// src/app/api/v1/payouts/route.ts (POST section)

export async function POST(req: Request) {
  const body = await req.json()
  const { settlement_id } = body

  const settlement = await prisma.settlement.findUnique({
    where: { id: settlement_id },
    include: { payment: true }
  })

  if (!settlement) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 })
  }

  // ✅ IMPLEMENT: Create MP transfer (requires seller's MP account ID)
  try {
    // Note: Seller must have linked their MP account and provided merchant_account_id
    const transferResponse = await axios.post(
      `${MP_API_BASE}/v1/transfers`,
      {
        receiver_id: settlement.seller_profile_id, // This should be seller's MP account
        amount: settlement.net_amount_cents / 100,
        description: `Settlement for order ${settlement.order_id}`
      },
      { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
    )

    const payout = await prisma.payout.create({
      data: {
        settlement_id,
        status: 'completed',
        transfer_id: transferResponse.data.id,
        completed_at: new Date(),
        attempts: 1
      }
    })

    await prisma.settlement.update({
      where: { id: settlement_id },
      data: { status: 'paid', paid_at: new Date() }
    })

    return NextResponse.json({ data: payout }, { status: 201 })
  } catch (err: any) {
    console.error('Transfer failed:', err.response?.data)
    return NextResponse.json(
      { error: { code: 'TRANSFER_FAILED', message: 'MP transfer API error' } },
      { status: 400 }
    )
  }
}
```

---

## 6. Error Handling & Retries

### 6.1 Implement Retry Logic

For failed outbound calls, use exponential backoff:

```typescript
// src/services/inter-app-client.service.ts (already implemented)

const RETRY_DELAYS = [1000, 3000, 9000] // 1s, 3s, 9s

async function retryableCall(callId: string, config: any, attemptNumber = 1) {
  try {
    return await axios(config)
  } catch (err) {
    const isLastRetry = attemptNumber > RETRY_DELAYS.length
    
    await logOutboundCall({
      call_id: callId,
      // ... log details
      attempts: attemptNumber,
      last_error: err.message
    })

    if (isLastRetry) throw err

    const delay = RETRY_DELAYS[attemptNumber - 1]
    await new Promise(resolve => setTimeout(resolve, delay))
    return retryableCall(callId, config, attemptNumber + 1)
  }
}
```

### 6.2 Handle MP API Errors

MP API returns structured errors. Handle gracefully:

```typescript
try {
  // MP call
} catch (err: any) {
  const mpError = err.response?.data?.error
  const statusCode = err.response?.status

  if (statusCode === 401) {
    console.error('Invalid MP credentials')
  } else if (statusCode === 429) {
    console.error('Rate limited - implement backoff')
  } else if (statusCode === 400) {
    console.error(`MP validation error: ${mpError?.message}`)
  } else {
    console.error(`MP API error: ${mpError?.message}`)
  }

  // Log and alert ops team
  await logFailedTransaction({
    type: 'mp_api_error',
    status: statusCode,
    error: mpError,
    timestamp: new Date()
  })
}
```

---

## 7. Sandbox Testing

### 7.1 Enable Sandbox Mode

1. In Mercado Pago **Settings > Credentials**, switch to **Sandbox**
2. Use sandbox credentials in env

### 7.2 Test Payment Cards

| Type | Card Number | CVC | Expiry |
|------|-------------|-----|--------|
| Visa | 4111111111111111 | 123 | 12/25 |
| Mastercard | 5555555555554444 | 123 | 12/25 |
| Approved | 4509953566233576 | 123 | 12/25 |
| Rejected | 4000000000000002 | 123 | 12/25 |

### 7.3 Test Webhook

```bash
curl -X POST http://localhost:3000/webhooks/mercadopago \
  -H "x-signature: ts=123,v1=SIGNATURE_PLACEHOLDER" \
  -H "x-request-id: v1-test" \
  -H "Content-Type: application/json" \
  -d '{"id":123,"type":"payment.created","data":{"id":456,"status":"approved"}}'
```

---

## 8. Production Checklist

- [ ] Move from sandbox to production credentials
- [ ] Implement proper signature validation in webhook handler
- [ ] Set up webhook URL in Mercado Pago dashboard
- [ ] Test full payment flow end-to-end
- [ ] Implement monitoring/alerting for MP API failures
- [ ] Set up payout reconciliation (verify transferred amounts)
- [ ] Test edge cases: duplicate webhooks, network timeouts, partial refunds
- [ ] Document seller onboarding (linking MP account)
- [ ] Set up test environment with production-like data
- [ ] Train support team on refund/payout workflows

---

## 9. Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhook not received | Webhook URL not registered or timeout | Check dashboard, verify URL is reachable, check logs |
| Signature validation fails | Wrong signing key or body tampering | Verify MP_WEBHOOK_SECRET, check if body is raw not parsed |
| Payment stuck in pending | Webhook not processed or timeout | Check webhook logs, manually retry webhook |
| Transfer fails | Seller account not linked or invalid | Require seller MP account setup, validate merchant_account_id |
| Rate limited | Too many API calls | Implement exponential backoff, batch operations |

---

## 10. References

- [Mercado Pago Checkout Preferences API](https://developers.mercadopago.com/en/reference/preferences/_checkout_preferences/post)
- [Mercado Pago Payments API](https://developers.mercadopago.com/en/reference/payments/_payments/get)
- [Mercado Pago Webhooks](https://developers.mercadopago.com/en/guides/webhooks)
- [Mercado Pago Transfers API](https://developers.mercadopago.com/en/reference/transfers/_transfers/post)
- [Webhook Signature Validation](https://developers.mercadopago.com/en/guides/webhooks/secure)

---

## Conclusion

This guide provides step-by-step instructions to integrate Mercado Pago with the BiciMarket Payments App. The current codebase is scaffolded and ready for integration. Follow the sections above to implement each piece and test thoroughly before going to production.
