# Integration & Communication Findings

---

## F-INT01 — `inter-app-client.service.ts` not used in webhook flow

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `01-descripcion.md §4.1`, `03-apis.md §P4`

**Code references**:
- `src/services/mp-webhook-processor.ts` — doesn't import or call inter-app client
- `src/services/inter-app-client.service.ts` — has `notifyBuyerOrderStatus` and `createSellerSalesOrder` but they're unused

**Problem**: The entire inter-app notification infrastructure exists but is disconnected from the webhook flow. The `processMpWebhookEvent()` function updates local state but never calls the services that would notify Buyer and Seller apps.

**Impact**: When a payment is approved via MP webhook:
1. ✅ Local payment record updated to `approved`
2. ✅ Receipt created
3. ❌ Buyer App NOT notified (order stays in `pending_payment`)
4. ❌ Seller NOT notified (no sales order created)
5. ❌ Shipping never creates a shipment
6. ❌ Marketplace stalls

**Recommended fix**: See F-C01.

---

## F-INT02 — `notifyBuyerOrderStatus` called but `createSellerSalesOrder` never called anywhere

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `03-apis.md §1465-1471` (notification map)

**Code references**:
- `src/services/inter-app-client.service.ts` — `createSellerSalesOrder` defined (lines 111-133) but never called
- `src/app/api/v1/payments/[paymentId]/refund/route.ts` — calls `notifyBuyerOrderStatus` (line 90)
- `src/app/api/v1/refunds/route.ts` — calls `notifyBuyerOrderStatus` (line 149)

**Problem**: The `createSellerSalesOrder` function is fully implemented with retry logic and request formatting, but no code path ever calls it. This means:
- Even if the webhook flow worked, seller sales orders would never be created
- The only notification sent is to Buyer (for refunds)

**Recommended fix**: Add `createSellerSalesOrder` calls in:
1. Webhook processor, after payment approved (for each seller in `items_summary`)
2. Admin confirm endpoint, after manual confirmation

---

## F-INT03 — Missing `POST /api/v1/internal/shipment-delivered` from Shipping → Payments integration test

**Severity**: Medium  
**Priority**: P1  
**Documentation**: `03-apis.md §SH4` (Shipping calls Payments)

**Code reference**: `src/app/api/v1/internal/shipment-delivered/route.ts`

**Problem**: The shipment-delivered endpoint accepts a call from Shipping App but there's no:
- Integration test to verify the contract
- Validation that the `sales_order_id` matches a known order
- Proper idempotency (same delivery notification could arrive twice)

**Recommended fix**:
1. Add idempotency check based on `(shipment_id, seller_profile_id)`
2. Add validation that the payment exists for `order_id`
3. Document the contract and add integration tests

---

## F-INT04 — No `BUYER_APP_URL` / `SELLER_APP_URL` validation before inter-app calls

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/services/inter-app-client.service.ts`

**Problem**: The inter-app client reads `BUYER_APP_URL` and `SELLER_APP_URL` from env vars. If these are misconfigured or empty, the client crashes. The `.env.example` shows localhost values but the `.env` file has Vercel deployment URLs for buyer and seller but EMPTY for `SHIPPING_APP_URL`.

**Current values**:
```
BUYER_APP_URL=https://proyecto-c-buyer2-bicimarket.vercel.app
SELLER_APP_URL=https://proyecto-c-seller-pierinospina.vercel.app
SHIPPING_APP_URL=
```

`SHIPPING_APP_URL` is empty — but Payments doesn't call Shipping currently, so this is OK. However, there's no validation.

**Recommended fix**: Add URL validation on startup and proper error messages.

---

## F-INT05 — Inter-app client uses `succeeded_at` but log retrieval has no `succeeded` filter

**Severity**: Low  
**Priority**: P3  
**Code reference**: `src/services/inter-app-client.service.ts` (sets `succeeded_at`)

**Problem**: The outbound call log records `succeeded_at` when a call succeeds, but no endpoint or admin UI filters by success/failure status. Failed calls can't be easily reviewed.

**Recommended fix**: Add a filter to the outbound calls admin UI (if one exists) or add an API endpoint to query failed calls.

---

## F-INT06 — Webhook processor creates PaymentAttempt without `payment_id` when payment not found

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/services/mp-webhook-processor.ts` (lines 110-122)

**Problem**: When the webhook processor can't find a matching local payment, it still creates a `PaymentAttempt` with `payment_id: undefined`. This creates orphaned attempt records.

**Recommended fix**: Only create PaymentAttempt if a valid payment was found:
```typescript
if (payment) {
  await prisma.paymentAttempt.create({ data: { payment_id: payment.id, ... } })
}
```

---

## F-INT07 — `notifySellerPaymentStatus` called with wrong status in shipment-delivered

**Severity**: High  
**Priority**: P2  
**Code reference**: `src/app/api/v1/internal/shipment-delivered/route.ts` (line 84)

**Problem**: When shipment is delivered, the route calls:
```typescript
await notifySellerPaymentStatus(sales_order_id, 'paid', settlement.id)
```

It passes `'paid'` as the payment status, but the documented payment status values for this PATCH are: `paid | refunded | settled`. Since the settlement was just created (or marked pending), `paid` is technically correct for early notification, but the docs say:
- Settlement `paid` → notify Seller with `settled`
- The settlement is `pending`, not yet `paid`

**Recommended fix**: The settlement should not notify Seller until the payout actually succeeds. Remove this early notification and move it to after the transfer completes.
