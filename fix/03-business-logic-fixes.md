# Fix: Business Logic Errors (BL-1–BL-7, SET-1, REF-1, ST-1)

## Problem

Multiple business logic issues existed:
- Settlement lifecycle violated docs — settlements created at payment approval, not on delivery
- Settlement amounts used `payment.amount_cents` (full total) instead of per-seller amounts
- Settlement state machine not enforced in shipment-delivered endpoint
- No state machine validation in webhook handler
- Idempotency only implemented on POST /payments
- No X-Request-Id propagation
- Settlement status history was incomplete (missing `from_status`)
- Refunds created no notifications to Buyer/Seller
- Partial refunds incorrectly marked entire payment as `refunded`

## Changes

### 1. Settlement Lifecycle Fix (SET-1) — **Critical**

**Per `docs/01-descripcion.md §4.1 Rule 5`**: Settlements must be created on delivery, not on payment approval.

**`src/webhooks/mercadopago/route.ts`**: Removed `createSettlementsForPayment()` call entirely. Settlements are no longer created at payment time.

**`src/services/settlement.service.ts`**: Removed the now-unused `createSettlementsForPayment()` function (dead code).

**`src/app/api/v1/internal/shipment-delivered/route.ts`**:
- New settlements are created with `status: 'pending'` (was `'paid'`) — aligning with docs §4.4 lifecycle
- Existing settlements transition via `validateSettlementTransition()` before marking `paid`
- Added `from_status` to all history creation calls
- Notifies seller with `payment_status: 'paid'` (reflects pending settlement created)

Per docs §4.4 flowchart: `settlement.status = pending → POST /v1/transfers → settlement.status = paid`. Creating as `pending` is the first step; the transfer flow is a separate concern.

### 2. Settlement Amounts Fix (BL-1)

**Before (critical financial bug)**:
```typescript
gross_amount_cents: payment.amount_cents, // Full payment, not seller's share
```

This meant in a multi-seller order of ARS 75,500 (Seller A: 66,200 + Seller B: 9,300), each seller's settlement used ARS 75,500.

**After**: Uses `items_summary` to find the per-seller breakdown, calculating gross from `subtotal_cents + shipping_cost_cents` for the specific seller.

### 3. `src/app/api/v1/payments/[paymentId]/refund/route.ts` — Refund notifications + partial refund (REF-1)

**Before**:
- No auth (anyone could call)
- No notification to Buyer or Seller
- Partial refunds marked entire payment as `refunded`

**After**:
- Validates Seller service token
- Notifies Buyer via `notifyBuyerOrderStatus()` when refund is approved
- Computes total refunded via `prisma.refund.aggregate({ _sum: { amount_cents } })`
- Only sets payment to `refunded` when total refunded >= payment amount
- Creates status history with full/partial distinction

### 4. `src/app/api/v1/refunds/route.ts` — Admin refund notifications (REF-1)

**Before**: No notification to Buyer on approval.

**After**: Same partial refund tracking logic + `notifyBuyerOrderStatus()` call when refund is approved.

### 5. State Machine Enforcement (ST-1)

**`src/app/api/v1/internal/shipment-delivered/route.ts`**: Added `validateSettlementTransition()` before updating existing settlement status to `paid`. Previously updated without validation.

State machines already exist at:
- `src/lib/state-machines/payment.ts` — Payment transitions
- `src/lib/state-machines/settlement.ts` — Settlement transitions

### 6. `src/lib/idempotency.ts` — Generic idempotency infrastructure (BL-3)

**Before**: Only checked `Payment.idempotency_key` — not applicable to refunds, payouts, or receipts.

**After**: Generic implementation using new `IdempotencyKey` table:
- `checkIdempotency(key)` — looks up key, returns cached response if found
- `cacheIdempotencyResponse(key, body, status)` — stores response with 24h TTL
- `extractIdempotencyKey(req)` — reads header (case-insensitive)

Applied to:
- `POST /api/v1/refunds`
- `POST /api/v1/payouts`
- `POST /api/v1/receipts`

### 7. `src/services/inter-app-client.service.ts` — X-Request-Id + dead code removal

- Every outbound call includes `X-Request-Id: <uuid>` header via Axios interceptor
- Removed unused `extractTargetApp()` and `extractPath()` helper functions
- Removed unused `AxiosInstance` import (was incorrectly removed then restored)
- Fixed `OutboundCallLog.method` type to use Prisma's `HttpMethod` enum instead of `as any`
