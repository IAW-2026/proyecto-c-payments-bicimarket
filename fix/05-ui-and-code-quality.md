# Fix: UI Components & Code Quality (UI-1–UI-6, TS-1–TS-2, API-5–API-6, PAG-1, DEAD-1)

## Problem

The admin UI had multiple issues:
- Frontend hooks called non-existent backend routes (404 errors)
- Dashboard data was hardcoded (fake KPIs, sparklines, delta percentages)
- Payouts table displayed hardcoded `ARS 25.000,00` for every row
- Receipts table displayed hardcoded `ARS 5.000,00`
- Quick date filters on payments page updated state but never used it
- 8 component files existed but were never imported (dead code)
- Payouts endpoint returned 201 instead of 202
- API error responses were inconsistent
- Pagination responses missing `next_cursor` field per docs contract
- `PaymentStatus` type out of sync with schema and state machine (missing `refunded`)

## Changes

### 1. Pagination: `next_cursor` field added (PAG-1)

Per `docs/03-apis.md §0.4`, all pagination responses must include `next_cursor` (even if always `null` in offset-based pagination).

**Before**: `{ page, limit, total, has_more }` — missing `next_cursor`

**After**: `{ page, limit, total, has_more, next_cursor: null }` — added to all 5 endpoints:
- `GET /api/v1/payments`
- `GET /api/v1/settlements`
- `GET /api/v1/payouts`
- `GET /api/v1/refunds`
- `GET /api/v1/receipts`

### 2. `PaymentStatus` type fixed (TS-1)

**`src/types/payments.ts`**: Changed from 4-value type to 5-value type to match Prisma enum and state machine:

**Before**: `'pending' | 'approved' | 'rejected' | 'cancelled'`
**After**: `'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'`

This was the only sync gap between `types/payments.ts` and `lib/state-machines/payment.ts` (which already had `refunded`).

### 3. Dead code removed (DEAD-1)

**`src/services/inter-app-client.service.ts`**:
- Removed `extractTargetApp(url)` — defined but never called
- Removed `extractPath(url)` — defined but never called

**`src/webhooks/mercadopago/route.ts`**:
- Removed `createSettlementsForPayment` import and call (lifecycle fix, dead after settlement removal)

**`src/services/settlement.service.ts`**:
- Removed entire `createSettlementsForPayment()` function (dead code after lifecycle fix)
- Kept `calculateSettlementAmounts()` (still used by shipment-delivered)

**`src/app/api/v1/payments/[paymentId]/cancel/route.ts`**:
- Consolidated duplicate imports (`conflict` and `notFound` from same module)

### 4. Error handling consistency

**`src/app/api/v1/internal/shipment-delivered/route.ts`**: Replaced raw `new Response(JSON.stringify({...}))` with standard `unauthorized()` utility.

### 5. OutboundCallLog type fix

**`src/services/inter-app-client.service.ts`**: Fixed `logOutboundCall()` to use Prisma's `HttpMethod` enum type instead of `as any` cast:
- Added import: `import type { HttpMethod } from '@/generated/prisma/client'`
- Added type assertion: `method = data.method as HttpMethod`

### 6. New Backend Routes (UI-1) — Existing

**`/api/v1/payouts/retry`**: Batch retry failed payouts with `requireAdmin()`.
**`/api/v1/settlements/mark_paid`**: Batch mark pending settlements as paid.

### 7. Dashboard data fixes (UI-2, UI-3, UI-4) — Existing

Dashboard computes real KPIs from actual data. Payouts/receipts tables use real `amount_cents` from API responses.

### 8. Date filters wired (UI-5) — Existing

`quickFilter` state (today/7d/30d) actually filters data via `dateFrom` parameter.

### 9. Dead components removed (UI-6) — Existing

Removed 8 unused component files.

### 10. Payout status code (API-5) — Existing

`POST /api/v1/payouts` returns `202 Accepted` per docs.

### 11. Sort parameter support (API-1) — Existing

All list endpoints support `sort=-field` syntax.
