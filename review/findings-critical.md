# Critical Findings

---

## F-C01 — Webhook processor never notifies Buyer/Seller apps

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `01-descripcion.md §4.1` (lines 88-90), `03-apis.md §1465-1471`, `07-integracion-mercadopago.md §Paso 8`

**Code references**:
- `src/services/mp-webhook-processor.ts` (lines 152-166, only creates receipt)
- `src/app/webhooks/mercadopago/route.ts`

**Problem**: When Mercado Pago sends a `payment.updated` webhook with `status=approved`, the `processMpWebhookEvent()` function updates the local payment record and creates a receipt, but does **NOT**:
1. Call `notifyBuyerOrderStatus()` to tell Buyer App that payment is approved (`PATCH /api/v1/orders/{id}/status`)
2. Call `createSellerSalesOrder()` to create sub-orders in Seller App (`POST /api/v1/sales-orders`)

This means the entire cross-app orchestration chain is broken — Buyer App never learns the payment went through, Seller App never gets its sales orders, and the marketplace stalls at `pending_payment`.

**Root cause**: The webhook processor was implemented as a local data persistence layer without the inter-app notification step that the architecture requires.

**Recommended fix**:
1. In `mp-webhook-processor.ts`, after updating payment to `approved`, iterate over `payment.items_summary` and for each seller:
   - Call `notifyBuyerOrderStatus(payment.order_id, 'paid', payment.id)`
   - Call `createSellerSalesOrder(seller.seller_profile_id, {...})` with all required fields
2. Add proper error handling (fire-and-forget is acceptable per docs, but log failures)
3. Ensure `items_summary` contains all fields needed for sales-order creation

**Estimated complexity**: 3 days  
**Risk if ignored**: Zero marketplace transactions complete. The system is non-functional.

---

## F-C02 — No Mercado Pago transfer execution (sellers never get paid)

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `01-descripcion.md §4.4` (lines 200-208), `03-apis.md §1438`, `04-modelo-de-datos.md §4.1` (Payout model)

**Code references**:
- `src/app/api/v1/internal/shipment-delivered/route.ts` (lines 58-81, creates settlement but never calls MP)
- `src/app/api/v1/payouts/route.ts` (lines 48-99, creates payout record but never transfers)
- `src/services/mercado-pago.service.ts` (missing `createTransfer()` function)
- `src/services/settlement.service.ts` (only calculates amounts, no transfer logic)

**Problem**: The documented flow says:
1. Shipping reports `delivered` → Payments creates `settlement` with `pending` status
2. Payments calls `POST /v1/transfers` to MP with `collector_id` and `amount=net`
3. Settlement transitions to `paid`

But the implementation:
1. Creates settlement (correct)
2. Does NOT call MP transfers API
3. `Payout` model exists but `POST /api/v1/payouts` only creates a local record, never calls MP
4. The `settlement.service.ts` has no transfer execution logic

**Root cause**: The payout/transfer orchestration was designed but the actual MP API integration was never written.

**Recommended fix**:
1. Add `createTransfer(collectorId: string, amountCents: number)` to `mercado-pago.service.ts`
2. In `shipment-delivered/route.ts`, after creating a pending settlement, trigger payout execution
3. In `payouts/route.ts`, after creating the payout record, call MP transfer API and update status
4. Add retry logic: on failure, increment `attempts`, retry up to 3 times, then mark `manual_review`

**Estimated complexity**: 2 days  
**Risk if ignored**: Sellers never receive funds, making the marketplace unsustainable.

---

## F-C03 — Most GET endpoints have no authentication

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `03-apis.md §0.2` (Headers), `05-usuarios.md §4` (Claims)

**Code references**:
- `src/app/api/v1/payments/route.ts` (lines 12-57, GET has no auth)
- `src/app/api/v1/settlements/route.ts` (GET has no auth)
- `src/app/api/v1/receipts/[receiptId]/route.ts` (GET has no auth)
- `src/app/api/v1/payments/[paymentId]/route.ts` (GET has no auth)
- `src/app/api/v1/payments/[paymentId]/cancel/route.ts` (POST has no auth)
- `src/proxy.ts` (lines 5-15, marks all `/api/v1(.*)` as public)

**Problem**: The Clerk middleware in `proxy.ts` marks all API routes as public. Individual route handlers are expected to implement their own auth, but many don't:
- `GET /api/v1/payments` — anyone can list all payments with amounts
- `GET /api/v1/settlements` — anyone can see seller payouts
- `GET /api/v1/receipts/{id}` — anyone can view receipts
- `GET /api/v1/payments/{id}` — anyone can view payment details including buyer info

**Root cause**: Auth was left as a "TODO per route" and most routes were never secured.

**Recommended fix**:
1. Add `requireAdmin()` or token validation to every route handler
2. Create a reusable middleware wrapper: `withAuth(handler, { requireAdmin?: boolean, requireServiceToken?: string[] })`
3. For server-to-server endpoints, validate `X-Service-Token`
4. For admin UI endpoints, validate JWT + `publicMetadata.admin=true`

**Estimated complexity**: 1 day  
**Risk if ignored**: Complete financial data exposure. PCI scope concerns.

---

## F-C04 — Settlement created as `paid` in shipment-delivered, bypassing payout flow

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `01-descripcion.md §4.4`, `04-modelo-de-datos.md §5.6` (settlement state machine)

**Code references**:
- `src/app/api/v1/internal/shipment-delivered/route.ts` (lines 33-56)

**Problem**: When a settlement already exists for a given `(payment_id, seller_profile_id)`, the `shipment-delivered` route:
1. Validates transition to `paid` via `validateSettlementTransition(settlement.status, 'paid')`
2. Immediately marks it as `paid`

This bypasses the entire payout flow: the settlement goes directly from whatever its current status is to `paid` without:
- Creating a payout record
- Calling MP transfers
- Retrying on failure

**Root cause**: The route confuses "creating a settlement" with "settling the settlement". The existence check was meant for idempotency but incorrectly marks as paid.

**Recommended fix**:
1. Remove the premature `paid` transition for existing settlements
2. Create settlement as `pending` if it doesn't exist
3. If it exists and is `pending`, leave it as `pending` (don't auto-transition)
4. The payout flow should handle the `pending → paid` transition

**Estimated complexity**: 4 hours  
**Risk if ignored**: Sellers marked as "paid" without actual transfer; accounting/financial records are incorrect.

---

## F-C05 — Duplicate refund logic across two routes with inconsistencies

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `03-apis.md §P1` (refund endpoints)

**Code references**:
- `src/app/api/v1/payments/[paymentId]/refund/route.ts` (113 lines)
- `src/app/api/v1/refunds/route.ts` (178 lines)

**Problem**: Refund processing logic is duplicated in two places:
1. `POST /api/v1/payments/{paymentId}/refund` — Seller-initiated (validates `X-Service-Token` seller)
2. `POST /api/v1/refunds` — Admin-initiated (validates `requireAdmin()`)

Key inconsistencies:
- The seller route doesn't check idempotency (`Idempotency-Key`) but the admin route does
- The seller route creates payment status history but the admin route does too — with different `changed_by` values
- The seller route doesn't fully mark the payment as `refunded` using `prisma.$transaction` but the admin route does
- The admin route doesn't use a transaction for the payment update

**Root cause**: Two developers or two PRs implementing the same logic without deduplication.

**Recommended fix**:
1. Extract common refund logic to `src/services/refund.service.ts`
2. Both routes call the shared service with different auth guards
3. Ensure both use idempotency, proper state transitions, and transactions

**Estimated complexity**: 1 day  
**Risk if ignored**: Inconsistent refund behavior; partial refunds may not be tracked correctly.

---

## F-C06 — Zero test coverage

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `guia-prisma-axios-tanstack.md` (mentions testing patterns)

**Code references**: No `*.test.ts` or `*.spec.ts` files exist anywhere in the repository.

**Problem**: The entire codebase has zero automated tests — no unit tests, no integration tests, no E2E tests. This includes:
- State machine transition logic (payment, settlement)
- Service layer (settlement calculation, MP integration, inter-app client)
- API route handlers
- Webhook signature validation
- Schema validation

**Root cause**: Testing was deprioritized or not yet started.

**Recommended fix**:
1. Add Vitest (already in devDependencies)
2. Write unit tests for all state machines
3. Write unit tests for `settlement.service.ts`
4. Write integration tests for API routes with mocked Prisma
5. Add CI pipeline to run tests on push

**Estimated complexity**: 5 days initial coverage  
**Risk if ignored**: Every change risks regression with no safety net.
