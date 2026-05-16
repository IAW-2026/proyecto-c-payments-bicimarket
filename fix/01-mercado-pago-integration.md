# Fix: Mercado Pago Integration (MP-1–MP-4, WH-1)

## Problem

The entire Mercado Pago integration was stubbed. All three exported functions in `mercado-pago.service.ts` were placeholders returning hardcoded values. Webhook signature validation required `x-request-id` which Mercado Pago does not send by default, causing every webhook to be rejected.

## Changes

### 1. `src/services/mercado-pago.service.ts` — Complete rewrite

**Before**: 21 lines of placeholder functions returning fake IDs and hardcoded `'approved'` status.

**After**: Real implementation with:
- **`createCheckoutPreference()`**: Calls `POST /checkout/preferences` with items, external_reference, return_urls, and payer info. Returns real `init_point` (checkout URL) and preference ID.
- **`getPayment()`**: Calls `GET /v1/payments/{id}` to resolve a payment's actual status from MP.
- **`createTransfer()`**: Calls `POST /v1/transfers` with collector_id and amount to pay out a seller.
- **`processRefund()`**: Calls `POST /v1/payments/{id}/refunds` with optional partial amount.

All functions use a shared Axios instance with `MERCADOPAGO_ACCESS_TOKEN` Bearer auth, 10s timeout.

### 2. `src/lib/webhook-signature.ts` — Fixed signature validation (WH-1)

**Before**: Required `x-request-id` header — returned `false` if absent. Since MP does not send `x-request-id` by default, every webhook was rejected.

```typescript
// Before: required x-request-id
if (!signatureHeader || !xRequestId) return false
const signedString = `${xRequestId},${parsed.ts},${body}`
```

**After**: Two-tier validation:
1. If `x-request-id` is present → enhanced validation: `HMAC(x-request-id, ts, body)`
2. If absent (standard MP webhooks) → fallback: `HMAC(body)`

```typescript
// After: works with or without x-request-id
if (xRequestId) {
  const signedString = `${xRequestId},${parsed.ts},${body}`
  return timingSafeEqual(computeHmacSha256(secret, signedString), parsed.v1)
}
const expected = computeHmacSha256(secret, body)
return timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.v1))
```

### 3. `src/webhooks/mercadopago/route.ts` — Settlement creation removed (SET-1)

**Critical fix**: Removed `createSettlementsForPayment()` call from the webhook handler when payment is approved.

**Per docs §4.1 Rule 5**: "La liquidación al vendedor se dispara por entrega confirmada (delivered), no por pago aprobado."

**Before**: Created settlements immediately on payment approval — incorrect lifecycle.
**After**: Settlements are only created on `shipment-delivered` from Shipping App.

Also removed unused `orderSellerGroupMapping` variable and `createSettlementsForPayment` import.

### 4. `src/app/api/v1/payments/[paymentId]/refund/route.ts` — Rewrite + auth + notifications

**Before**: Created refund DB record with `status: 'pending'` and stopped. No MP API call. No auth. No notifications.

**After**: 
- Added Seller service token validation (`validateServiceTokenSeller()`)
- Calls `processRefund()` on MP after creating the DB record
- Partial refunds no longer mark the entire payment as `refunded` (only full refund)
- Added `notifyBuyerOrderStatus()` when refund is approved
- Proper partial refund tracking via `refund.aggregate({ _sum: { amount_cents } })`

### 5. `src/app/api/v1/payments/route.ts` — POST /payments updated

**Before**: Created payment record but skipped MP preference creation (commented out with TODO).

**After**:
- Calls `createCheckoutPreference()` with item details from `items_summary`
- Stores `gateway_reference` and `checkout_url` on the response
- Returns `checkout_url` and `gateway_reference` in the API response

### 6. `src/app/api/v1/payouts/route.ts` — POST /payouts updated + auth + idempotency

**Before**: Created payout DB record with no MP transfer. No auth. No idempotency.

**After**:
- Added `requireAdmin()` to both GET and POST handlers
- Added `Idempotency-Key` support via generic `checkIdempotency()`/`cacheIdempotencyResponse()`
- Returns `202 Accepted` status per docs
