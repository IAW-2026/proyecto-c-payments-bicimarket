# Business Logic — Audit Findings

---

## Finding BL-1: Settlement Amounts Wrong in Shipment-Delivered Fallback Path

**Severity**: Critical | **Priority**: P0

**Documentation**: 
- `docs/01-descripcion.md §4.4` — Settlement created per seller with gross/fee/net
- `docs/04-modelo-de-datos.md §4.1` — `gross_amount_cents` = subtotal + shipping of the seller

**Code**: `src/app/api/v1/internal/shipment-delivered/route.ts:75-90`
```typescript
// Create new settlement - should have been created earlier
settlement = await prisma.settlement.create({
  data: {
    gross_amount_cents: payment.amount_cents, // WRONG: full payment, not seller's share
    fee_amount_cents: Math.round((10 / 100) * payment.amount_cents),
    net_amount_cents: Math.round(payment.amount_cents * 0.9),
    ...
  }
})
```

**Problem**: When a settlement doesn't exist (fallback path), the code uses `payment.amount_cents` (the TOTAL paid by the buyer across all sellers) as the `gross_amount_cents` for a single seller. 

Example: Buyer pays ARS 75,500 for items from Seller A (66,200) and Seller B (9,300). When Seller A's shipment is delivered, this code would create a settlement with gross of ARS 75,500 — the full payment amount — instead of ARS 66,200.

This means:
- Seller A would receive payment from all sellers' amounts
- If both sellers' shipments deliver, the total settled amount could exceed the payment amount
- The marketplace fee would be wrong

**Root Cause**: The settlement creation path doesn't have access to per-seller amounts (`items_summary`) since that data was only in the original payment creation request, not stored for later use.

**Solution**: 
1. Store `items_summary` from the original payment request in the payment record (or a related table)
2. Look up the seller-specific amount when creating settlement on shipment delivery
3. Never fall back to the full payment amount

**Risk if ignored**: Sellers could be massively overpaid, causing financial loss to the marketplace.

---

## Finding BL-2: Settlement Flow Is Inverted vs Documentation

**Severity**: High | **Priority**: P1

**Documentation**: 
- `docs/01-descripcion.md §4.4` — Settlement created when shipment is delivered, THEN transfer initiated
- `docs/04-modelo-de-datos.md §4.1` — Settlements created per seller at payment time, status flips on delivery

**Code**: 
- `src/services/settlement.service.ts` — `createSettlementsForPayment` creates settlements at payment time with `status: 'pending'`
- `src/app/api/v1/internal/shipment-delivered/route.ts` — On delivery, either updates existing settlement to 'paid' OR creates it from scratch

**Problem**: There are TWO conflicting approaches:
1. `settlement.service.ts` creates settlements at payment approval time (status=pending), to be flipped to 'paid' on delivery
2. `shipment-delivered/route.ts` fallback path creates settlements on delivery directly with status='paid'

The main code path (`settlement.service.ts`) is never called because the webhook processor (which should call it after payment approval) is empty. So settlements only get created in the fallback path, which uses wrong amounts (see BL-1).

**Root Cause**: After-payment settlement creation was never wired up (webhook no-op) and the fallback path has bugs.

**Solution**: 
1. Wire `createSettlementsForPayment` into the webhook processing flow
2. Remove the fallback creation from `shipment-delivered` (or keep it with correct amounts as safety net)
3. The `shipment-delivered` route should only transition `pending` → `paid`, not create new settlements

**Risk if ignored**: Financial calculations are incorrect, and settlements may be created at the wrong time.

---

## Finding BL-3: No Idempotency on Critical Endpoints

**Severity**: High | **Priority**: P1

**Documentation**: `docs/02-responsabilidades.md §2.5` — "Todo POST que crea recursos acepta header `Idempotency-Key`. Si llega un retry con la misma key, devuelve la misma response sin duplicar."

**Code**: 
- `POST /api/v1/payments` — Has idempotency ✓
- `POST /api/v1/refunds` — Missing idempotency
- `POST /api/v1/payouts` — Missing idempotency
- `POST /api/v1/settlements` — Missing idempotency
- `POST /api/v1/receipts` — Missing idempotency

**Problem**: Only the payments POST route implements idempotency. All other POST endpoints that create resources lack idempotency checks, meaning network retries could cause duplicate refunds, payouts, settlements, or receipts.

**Root Cause**: Idempotency was implemented only for the most obvious case (payments) and not extended to other resources.

**Solution**: Implement idempotency key checking on all POST routes that create resources. Use a shared utility or store idempotency keys in a dedicated table.

**Risk if ignored**: Duplicate refunds could result in actual financial losses, as MP would process each refund.

---

## Finding BL-4: No State Machine Enforcement

**Severity**: High | **Priority**: P1

**Documentation**: `docs/06-estados-y-diagramas.md §5` — Provides explicit state transition tables that every app must enforce with HTTP 409 INVALID_TRANSITION.

**Code**: The only state validation is in cancel route:
```typescript
if (payment.status !== 'pending') { ... return 409 CONFLICT }
```

**Problem**: There is no centralized state machine validation. Any route could transition a payment from any state to any other state via the Prisma update call. For example:
- `approved` → `pending` (impossible in real world)
- `cancelled` → `approved` (invalid)
- Multiple `pending` → `approved` transitions possible

The confirm route, the webhook, and any future code can set any status value without validation against allowed transitions.

**Root Cause**: State machines were documented but never implemented as code.

**Solution**: 
1. Create a `PaymentStateMachine` class with the documented transition rules
2. Before any status update, validate that the transition is allowed
3. Return 409 `INVALID_TRANSITION` for disallowed transitions
4. Apply the same pattern to Settlement, Refund, and Payout status changes
5. Use Prisma transactions to ensure atomicity

**Risk if ignored**: Data integrity issues where payment records enter impossible states. Financial reconciliation becomes unreliable.

---

## Finding BL-5: Partial Refunds Per Seller Not Implemented

**Severity**: High | **Priority**: P1

**Documentation**: `docs/03-apis.md §P1` — 
- Refund request includes `seller_profile_id`
- Partial refunds are supported per seller
- Refund reason `seller_rejected` should refund only that seller's portion

**Code**: 
- `src/app/api/v1/payments/[paymentId]/refund/route.ts` — Refund route accepts `seller_profile_id` from body but doesn't validate it against payment items
- No logic to calculate per-seller refund amounts

**Problem**: The code accepts a `seller_profile_id` field but does nothing with it. There's no validation that the seller is actually part of this payment, and no calculation of how much belongs to that specific seller. A refund for `seller_rejected` should only refund that seller's amount (items + shipping), but the code creates a refund without any seller-specific logic.

**Root Cause**: The refund route was implemented before the multi-seller requirement was fully understood.

**Solution**:
1. When `seller_profile_id` is provided, validate it exists in the payment's items
2. Calculate the refundable amount for that seller (subtotal + shipping)
3. Validate that `amount_cents` doesn't exceed the seller's portion
4. Log which seller the refund applies to

**Risk if ignored**: Sellers could be incorrectly charged for refunds that should be attributed to other sellers in a multi-seller order.

---

## Finding BL-6: Payout Route Doesn't Execute Transfers

**Severity**: Critical | **Priority**: P0

**Documentation**: `docs/03-apis.md §P3` — POST /api/v1/payouts "dispara la transferencia real a Mercado Pago"

**Code**: `src/app/api/v1/payouts/route.ts:45-83`
```typescript
const payout = await prisma.payout.create({ data: { settlement_id, status: 'pending', attempts: 0 } })
return NextResponse.json({ data: payout }, { status: 201 })
```

**Problem**: The payout route creates a DB record but NEVER calls Mercado Pago to execute the actual transfer. The `createTransfer` function exists in `mercado-pago.service.ts` but is never called from the payout route. After payout creation, the money never actually moves.

**Root Cause**: The MP integration was never wired to the payout flow.

**Solution**: 
1. After creating the payout record, call `createTransfer` to MP
2. Update payout status based on MP response
3. Update settlement status to `paid` or `failed` based on transfer result
4. Implement the retry logic (3 attempts with backoff) for failed transfers

**Risk if ignored**: Sellers never receive their money. The marketplace is non-functional.

---

## Finding BL-7: Missing Retry-Payment Flow

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/06-estados-y-diagramas.md §2` — Shows `POST /api/v1/orders/{id}/retry-payment` for retrying after payment failure.

**Code**: No such route exists.

**Problem**: When a payment is rejected, there's no documented way for the buyer to retry. The diagram shows this as a future feature but the code doesn't support it.

**Root Cause**: Not implemented (marked as "futuro" in docs).

**Solution**: Implement retry-payment flow that:
1. Verifies the order is in `payment_failed` status
2. Creates a new payment attempt
3. Generates a new MP checkout URL
4. Returns the URL to Buyer App

**Risk if ignored**: Buyers must create a new order from scratch if payment fails.

---

## Finding BL-8: Settlement Status History Not Properly Tracked

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/04-modelo-de-datos.md §0.7` — "cualquier cambio de estado relevante deja registro en una tabla `*_status_history`"

**Code**: 
- `SettlementStatusHistory` model exists and is used in `shipment-delivered` route
- BUT the `POST /api/v1/settlements` route doesn't create an initial status history entry
- The payout route doesn't record settlement status changes when payout completes

**Problem**: Status history tracking is inconsistent. Initial status is not recorded, and changes from the payout flow are not captured.

**Root Cause**: Status history patterns were not consistently applied across all routes.

**Solution**: Add `SettlementStatusHistory` creation to:
1. `POST /api/v1/settlements` (initial entry)
2. Payout completion/failure flow
3. All manual status changes

**Risk if ignored**: Audit trail is incomplete for settlement lifecycle.
