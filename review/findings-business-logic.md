# Business Logic & Domain Findings

---

## F-BL01 — Settlement lifecycle violates documented state machine

**Severity**: High  
**Priority**: P1  
**Documentation**: `04-modelo-de-datos.md §5.6` (settlement.status transitions), `06-estados-y-diagramas.md §1.6`

**Code references**:
- `src/app/api/v1/internal/shipment-delivered/route.ts`
- `src/app/api/v1/settlements/mark_paid/route.ts`

**Problem**: The documented settlement state machine is:
```
pending ─► paid (terminal)
pending ─► failed ─► (retry) ─► paid
failed ─► manual_review (terminal)
```

But the implementation:
1. `shipment-delivered` sometimes creates settlements directly as `paid` (when they already exist)
2. `mark_paid/route.ts` transitions `pending → paid` without calling `validateSettlementTransition()`
3. No code implements `failed → paid` (retry) or `failed → manual_review`
4. No code implements the 3-retry with exponential backoff documented in `01-descripcion.md §4.4`

**Recommended fix**: 
1. Create a `SettlementStateMachine` service class
2. All status changes go through it
3. Add retry logic with backoff
4. Remove the `mark_paid` direct route; replace with a `retry-payout` endpoint

---

## F-BL02 — Payment `approved → refunded` transition doesn't update order

**Severity**: High  
**Priority**: P1  
**Documentation**: `01-descripcion.md §4.1`, `06-estados-y-diagramas.md §3`

**Code reference**: `src/app/api/v1/payments/[paymentId]/refund/route.ts`

**Problem**: When a refund is processed (either full or partial), the code:
1. Only notifies Buyer with `notifyBuyerOrderStatus(order_id, 'refunded', ...)` for full refunds
2. Does NOT notify Seller that the sales order payment status has changed
3. For partial refunds, Buyer is incorrectly told the entire order is `refunded`

The doc says refunds should:
- Notify Buyer (`PATCH /orders/{id}/status` or `PATCH /orders/{id}/seller-groups/{g}/status`)
- Notify Seller (`PATCH /sales-orders/{id}/payment-status`)

**Recommended fix**: 
1. For full refunds: notify Buyer with `refunded`, notify Seller with `refunded`
2. For partial refunds: notify Buyer with seller-group level update, NOT order-level refunded
3. Use the `items_summary.seller_profile_id` to determine which seller to notify

---

## F-BL03 — Missing `sellers_profile_id` in refund creates ambiguity

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `03-apis.md §P1` (refund request)

**Code references**:
- `src/app/api/v1/payments/[paymentId]/refund/route.ts` (line 32)
- `src/app/api/v1/refunds/route.ts` (line 74)

**Problem**: The refund request includes `seller_profile_id` as optional, but if not provided, the system can't determine which seller's settlement to adjust. For multi-seller orders, a refund without `seller_profile_id` is ambiguous.

**Recommended fix**: Make `seller_profile_id` required when `items_summary` has multiple sellers. Validate that the seller exists in the payment's items_summary.

---

## F-BL04 — No rate limiting anywhere

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `03-apis.md §0.3` (429 RATE_LIMITED defined but never used)

**Code reference**: No rate limiting implementation exists.

**Problem**: The error format defines a `429 RATE_LIMITED` response but no rate limiting middleware is implemented. The webhook and payment creation endpoints could be flooded.

**Recommended fix**: Add a simple in-memory or Redis-based rate limiter, especially for:
- `POST /api/v1/payments` (payment creation)
- `POST /webhooks/mercadopago` (webhook receiver)

---

## F-BL05 — `notifyBuyerOrderStatus` called with `refunded` for both full and partial refunds

**Severity**: High  
**Priority**: P1  
**Documentation**: `06-estados-y-diagramas.md §3`

**Code reference**: `src/app/api/v1/payments/[paymentId]/refund/route.ts` (line 90)

**Problem**: When a partial refund is processed, the code still calls:
```typescript
await notifyBuyerOrderStatus(payment.order_id, 'refunded', payment.id)
```

This tells Buyer App the entire order is refunded when only a portion was refunded. For multi-seller orders, this is incorrect — Buyer should only see a seller-group level status change for partial refunds.

**Recommended fix**: For partial refunds, don't notify Buyer with `refunded` unless all sellers are fully refunded. Consider implementing a seller-group level notification endpoint.

---

## F-BL06 — No `settlement` trigger on successful payout

**Severity**: High  
**Priority**: P1  
**Documentation**: `04-modelo-de-datos.md §5.6`

**Code reference**: `src/app/api/v1/payouts/route.ts`

**Problem**: After creating a payout, no code transitions the settlement to `paid` when the payout completes. The settlement status and payout status are disconnected.

**Recommended fix**: After successful MP transfer, update settlement status to `paid` and call `notifySellerPaymentStatus()`.

---

## F-BL07 — Missing `retry-payment` or order re-payment flow

**Severity**: Low  
**Priority**: P3  
**Documentation**: `06-estados-y-diagramas.md §2` (references `POST /api/v1/orders/{id}/retry-payment` as future)

**Code reference**: Not implemented.

**Problem**: When a payment fails (`status=rejected`), the doc mentions a future `retry-payment` flow. Without it, rejected orders are dead — the buyer must create a new order from scratch.

**Recommended fix**: Document as known limitation (not in scope). The doc already marks it as future work, but note it's not implemented.
