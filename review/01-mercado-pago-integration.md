# Mercado Pago Integration — Audit Findings

**Severity**: Critical | **Priority**: P0

## Summary

The Mercado Pago integration is entirely stubbed/mocked. No real API calls are made despite the documented flows depending entirely on MP for payment processing, refunds, and transfers. The project cannot process a single real payment in its current state.

---

## Finding MP-1: Payment Creation Does Not Create MP Preference

**Severity**: Critical | **Priority**: P0

**Documentation**: `docs/03-apis.md §P1` — POST /api/v1/payments must create a Mercado Pago checkout preference and return `checkout_url`.

**Code**: `src/app/api/v1/payments/route.ts:104-106`
```typescript
// TODO: Create MercadoPago checkout preference
// const pref = await createCheckoutPreference({ amount: payment.amount_cents, external_reference: payment.order_id })
// await prisma.payment.update({ where: { id: payment.id }, data: { gateway_reference: pref.id } })
```

**Problem**: The MP preference creation is commented out with a TODO. The response returns `{ data: { ...payment } }` without `checkout_url`, `method`, or `gateway_reference`. Buyer App would receive a payment object without a URL to redirect the customer to MP checkout.

**Root Cause**: Never implemented — `mercado-pago.service.ts` only contains placeholder functions.

**Solution**: 
1. Implement `createCheckoutPreference` with real MP API call using `MERCADOPAGO_ACCESS_TOKEN`
2. Pass `external_reference = payment.order_id` for traceability
3. Store gateway reference and checkout_url on the payment record
4. Return the checkout_url in the response

**Risk if ignored**: Zero real payment processing capability. The entire marketplace cannot function.

---

## Finding MP-2: Mercado Pago Service Is Entirely Stubbed

**Severity**: Critical | **Priority**: P0

**Documentation**: `docs/03-apis.md §Integración Mercado Pago` — Defines 6 MP endpoints that must be consumed.

**Code**: `src/services/mercado-pago.service.ts` (entire file — 21 lines)

**Problem**: All three exported functions are placeholders:
- `createCheckoutPreference`: Returns a fake ID with `Date.now()` and a mock URL
- `getPayment`: Always returns `{ status: 'approved' }` regardless of actual MP state
- `createTransfer`: Returns a hardcoded `'mp_transfer_mock'` — no actual transfer happens

No calls to actual MP API endpoints: `/checkout/preferences`, `/v1/payments`, `/v1/payments/{id}/refunds`, `/v1/transfers`, etc.

**Root Cause**: The MP integration layer was never wired up. The service was created as a placeholder and never completed.

**Solution**: Rewrite the entire service to:
1. Use the `MERCADOPAGO_ACCESS_TOKEN` for auth
2. Implement all 6 documented MP endpoints
3. Handle MP-specific errors and rate limits
4. Include proper error mapping to domain errors

**Risk if ignored**: System cannot process, refund, or transfer any money.

---

## Finding MP-3: Webhook Signature Validation Is a Mock

**Severity**: Critical | **Priority**: P0

**Documentation**: `docs/03-apis.md §P4` — "Validar firma con `MERCADOPAGO_WEBHOOK_SECRET`"

**Code**: `src/webhooks/mercadopago/route.ts:48-63`

```typescript
function validateMercadoPagoSignature(payload: any, signature: string | null, xRequestId: string | null): boolean {
  if (!signature || !xRequestId) return false
  // Placeholder: just check that both exist
  return signature.length > 0 && xRequestId.length > 0
}
```

**Problem**: The function claims to validate but only checks that headers are non-empty strings. Any request with a non-empty `x-signature` and `x-request-id` passes validation. This means an attacker could send fake webhooks that would be accepted as valid.

Additionally, the code accepts the webhook even when signature is invalid (returns 200 with a warning), which goes against documented security requirements.

**Root Cause**: HMAC-SHA256 validation was never implemented as described in the comments.

**Solution**: Implement proper HMAC-SHA256 validation as documented in the inline comments:
1. Extract `ts` and `v1` from the `x-signature` header
2. Construct the signed string: `"{request_id},{timestamp},{body}"`
3. Compute HMAC-SHA256 using `MERCADOPAGO_WEBHOOK_SECRET`
4. Compare with the provided signature
5. Reject requests with invalid signatures (return 401)

**Risk if ignored**: Anyone who knows the webhook URL can send fake payment confirmations, triggering order fulfillment without actual payment.

---

## Finding MP-4: Refund Route Does Not Call MP API

**Severity**: Critical | **Priority**: P0

**Documentation**: `docs/03-apis.md §P1` — POST /api/v1/payments/{paymentId}/refund must call MP refund API.

**Code**: 
- `src/app/api/v1/payments/[paymentId]/refund/route.ts:58-66`
- `src/app/api/v1/refunds/route.ts:127-135`

**Problem**: Both refund routes create a `refund` record in the database with `status: 'pending'` and stop. The MP API call to `/v1/payments/{id}/refunds` is commented out. Refunds are never actually processed against the payment gateway — they just exist as DB records.

**Root Cause**: The MP integration was never completed.

**Solution**: 
1. Implement the MP refund API call
2. Update refund status to `approved` or `failed` based on MP response
3. Store MP `gateway_reference` for traceability
4. Handle partial refunds correctly

**Risk if ignored**: When a seller rejects an order and a "refund" is created, no money is actually returned to the buyer. The refund exists only in the database.

---

## Finding MP-5: Webhook Processing Is Empty — No Downstream Effects

**Severity**: Critical | **Priority**: P0

**Documentation**: 
- `docs/01-descripcion.md §4.1` — Flow diagram shows P→MP→P webhook, then P→B and P→S calls
- `docs/03-apis.md §P4` — "Tras recibir, Payments hace GET /v1/payments/{id} a MP para resolver el estado real, actualiza su payment y dispara las llamadas REST salientes a Buyer y Seller"

**Code**: `src/webhooks/mercadopago/route.ts:65-91`

```typescript
async function processWebhookEvent(payload: any) {
  const eventType = payload?.type || ''
  if (eventType.includes('payment')) {
    const resource = payload?.data?.id
    console.log(`Processing payment event: resource=${resource}`)
    // TODO: Look up payment by gateway_reference = resource
    // If payment.status is pending and new status is approved:
    //   - Update payment.status = approved, payment.approved_at = now
    //   - Call notifyBuyerOrderStatus(payment.order_id, 'paid')
    //   - Call createSellerSalesOrders for each seller group
  }
}
```

**Problem**: The webhook processing function is a shell. It logs the event but:
1. Does NOT resolve the real MP payment status via GET /v1/payments/{id}
2. Does NOT update the payment status in the database
3. Does NOT call `notifyBuyerOrderStatus` to inform Buyer App
4. Does NOT call `createSellerSalesOrder` to create sub-orders in Seller App
5. Does NOT create settlements

The entire post-payment flow documented in the sequence diagram (section 4.1, steps 88-100) depends on this function but none of it works.

**Root Cause**: The core business logic after payment approval was never implemented.

**Solution**: Implement the full webhook processing pipeline:
1. Fetch real MP payment status
2. Update local payment record with gateway status
3. If approved: call `notifyBuyerOrderStatus(orderId, 'paid')` 
4. If approved: call `createSellerSalesOrders` for each seller group
5. Handle rejected payments similarly
6. Log all outbound calls

**Risk if ignored**: The entire order lifecycle after payment is broken. No orders advance past `pending_payment`.
