# API Contract Violations

---

## F-API01 — `POST /api/v1/payments` response shape mismatch

**Severity**: High  
**Priority**: P1  
**Documentation**: `03-apis.md §P1` (response 201)

**Code reference**: `src/app/api/v1/payments/route.ts` (lines 171-174)

**What exists**: The route returns:
```json
{
  "data": { "payment_id": "pay_…", "init_point": "https://…", "preference_id": "…" },
  "public_key": "APP_USR_…"
}
```

**What docs require**:
```json
{
  "id": "pay_…",
  "order_id": "ord_…",
  "amount_cents": 75500000,
  "currency": "ARS",
  "status": "pending",
  "method": null,
  "checkout_url": "https://www.mercadopago.com.ar/…",
  "gateway_reference": "mp_pref_2426354",
  "created_at": "2026-04-25T14:33:00Z"
}
```

**Why it matters**: Every consumer of this endpoint (Buyer App, Checkout UI) is coupled to the wrong response shape. The frontend `checkout-form.tsx` accesses `resp.data.payment_id` which won't exist if the response is fixed to match docs.

**Recommended fix**: Change the response to match the documented shape. Update all consumers (checkout-form, checkout page, hooks) to use the new shape.

**Estimated complexity**: 4 hours

---

## F-API02 — Idempotency cache returns wrong response shape

**Severity**: High  
**Priority**: P1  
**Documentation**: `02-responsabilidades.md §2` (Idempotencia rule), `03-apis.md §0.2`

**Code references**:
- `src/lib/idempotency.ts` (lines 18-26, checkIdempotency)
- `src/app/api/v1/payments/route.ts` (lines 69-81)

**Problem**: When a duplicate request comes with the same `Idempotency-Key`, the `checkIdempotency()` function returns the raw cached response, which is:
```json
{ "data": { "payment_id": "…", "init_point": "…", "preference_id": "…" }, "public_key": "…" }
```

But the `findByIdempotencyKey()` function (line 70-73) returns a different shape:
```json
{ "data": { entire Payment model } }
```

Two different idempotency checks return two different shapes for the same key.

**Root cause**: `checkIdempotency()` caches the route's custom response, while `findByIdempotencyKey()` returns the raw Prisma model.

**Recommended fix**: Use a single idempotency mechanism. Cache the final response and always return it. Remove `findByIdempotencyKey()` or align its return shape.

**Estimated complexity**: 2 hours

---

## F-API03 — `POST /api/v1/payments` validates `items_summary` but response doesn't include it

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `03-apis.md §P1`

**Problem**: The request includes `items_summary` with per-seller breakdown, but the response and the stored `Payment` model don't echo back the per-seller amounts. The `items_summary` is stored as JSON but not returned in any response.

**Why it matters**: Consumer apps need to know the per-seller breakdown from the payment response. Without it, they must make additional queries.

**Recommended fix**: Include `items_summary` in the payment response and expose it via `GET /api/v1/payments/{id}`.

---

## F-API04 — `PATCH /api/v1/payments/{paymentId}/confirm` doesn't notify Buyer

**Severity**: High  
**Priority**: P1  
**Documentation**: `03-apis.md §P1` (confirm endpoint)

**Code reference**: `src/app/api/v1/payments/[paymentId]/confirm/route.ts`

**Problem**: When admin confirms a payment via `PATCH /confirm`, the payment status changes but no inter-app notification is sent to Buyer or Seller apps. This bypasses the documented webhook flow and leaves Buyer/Seller uninformed.

**Recommended fix**: After successful confirmation, call `notifyBuyerOrderStatus()` and `createSellerSalesOrder()` — same as the webhook processor should do.

---

## F-API05 — Missing `GET /api/v1/payments/{paymentId}` response fields

**Severity**: Low  
**Priority**: P3  
**Documentation**: `03-apis.md §P1` (response 200)

**Code reference**: `src/app/api/v1/payments/[paymentId]/route.ts` (lines 12-20)

**Problem**: The response should include `buyer_clerk_user_id`, `method`, `card_last4`, `gateway_reference`, `approved_at` but the code returns the full Prisma model which may include internal fields like `deleted_at`, `idempotency_key`.

**Recommended fix**: Select specific fields for the response, excluding internal ones.

---

## F-API06 — Error format inconsistencies

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `03-apis.md §0.3` (Error format)

**Code references**:
- `src/app/api/v1/refunds/[refundId]/route.ts` (lines 59-63 uses `INVALID_PAYLOAD`)
- `src/app/api/v1/payments/[paymentId]/route.ts` (lines 23-26 uses inline error)
- `src/app/api/v1/receipts/[receiptId]/route.ts` (lines 22-25 uses inline error)

**Problem**: Several endpoints don't use the `errorResponse()` helper and return inconsistent error shapes:
- Some return `{ error: { code, message } }` (correct per docs)
- Some return `{ error: { code, message } }` inline without `details`
- Some use `INVALID_PAYLOAD` instead of `BAD_REQUEST`
- Some don't include `details` when they should

**Recommended fix**: Use `errorResponse()` consistently in all route handlers. Remove inline error construction.

---

## F-API07 — `GET /api/v1/settlements` missing `?sellerId=...` response enrichment

**Severity**: Low  
**Priority**: P3  
**Documentation**: `03-apis.md §P3`

**Code reference**: `src/app/api/v1/settlements/route.ts`

**Problem**: The settlement list response should include `paid_at` and `transfer_id` if paid, per docs. The current response returns the raw model without enriched fields.

**Recommended fix**: Add computed fields to the response based on settlement status.
