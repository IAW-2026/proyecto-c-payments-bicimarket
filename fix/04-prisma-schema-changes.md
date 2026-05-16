# Fix: Prisma Schema & Database (DB-1–DB-6, INFRA-1, API-7, DB-IDEM)

## Problem

The Prisma schema had multiple issues compared to the documented data model:
- Missing fields: `method`, `card_last4`, `cancelled_at`, `items_summary` on Payment
- Missing fields: `request_payload`, `response_payload` on PaymentAttempt
- Missing field: `currency` on Refund
- Missing field: `deleted_at` on Payout
- String fields instead of enums for multiple status columns
- No ID prefixing (IDs like `pay_...`, `set_...` instead of plain cuid)
- No generic idempotency key storage for non-Payment resources
- No error handling middleware

## Changes

### 1. `prisma/schema.prisma` — Schema updates

**Added `IdempotencyKey` model** (DB-IDEM):
```prisma
model IdempotencyKey {
  id         String   @id @default(cuid())
  key        String   @unique
  response   Json
  status     Int
  created_at DateTime @default(now())
  expires_at DateTime?

  @@index([key])
  @@index([created_at])
}
```

This stores idempotency key → response mappings for any endpoint, with 24h TTL.

**Previously added enums**:
| Enum | Values |
|------|--------|
| `PaymentMethod` | `credit_card`, `debit_card`, `account_money`, `pix`, `bank_transfer` |
| `PaymentAttemptStatus` | `pending`, `approved`, `rejected`, `cancelled` |
| `PayoutStatus` | `pending`, `in_progress`, `completed`, `failed`, `manual_review` |
| `RefundReason` | `seller_rejected`, `buyer_cancelled`, `not_delivered`, `manual` |
| `WebhookEventStatus` | `received`, `processed`, `failed` |
| `HttpMethod` | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` |

**Previously added fields**:
- Payment: `method`, `card_last4`, `cancelled_at`, `items_summary`
- PaymentAttempt: `request_payload`, `response_payload`, `status` (enum)
- Payout: `deleted_at`, `status` (enum)
- Refund: `currency`, `reason` (enum)

### 2. `src/lib/id-generator.ts` — Added IdempotencyKey prefix

Added `IdempotencyKey: 'ik'` to the `PREFIXES` mapping.

Existing prefix mapping includes all 11 models: `pay`, `psh`, `pat`, `rec`, `set`, `ssh`, `pyt`, `ref`, `rsh`, `whe`, `ocl`, `ik`.

### 3. `src/lib/idempotency.ts` — Rewritten for generic use

**Before**: Only checked `Payment.idempotency_key` — not applicable to other resources.

**After**: Three exported functions:
- `extractIdempotencyKey(req)` — case-insensitive header extraction (no `@ts-ignore`)
- `checkIdempotency(key)` — queries `IdempotencyKey` table, returns cached `NextResponse` or `{ cached: false }`
- `cacheIdempotencyResponse(key, body, status)` — stores response with 24h TTL

### 4. `src/lib/errors.ts` — Existing error utilities

Standardized error responses per `docs/03-apis.md §0.3`.

Functions: `errorResponse()`, `badRequest()`, `unauthorized()`, `forbidden()`, `notFound()`, `conflict()`, `unprocessable()`, `internalError()`, `handleRouteError()`.

`handleRouteError()` catches `InvalidTransitionError` → 409, `SyntaxError` → 400, everything else → 500.

### 5. Error response consistency fix

**`src/app/api/v1/internal/shipment-delivered/route.ts`**: Replaced raw `new Response(JSON.stringify(...))` with `unauthorized()` utility function.

**`src/app/api/v1/payments/[paymentId]/cancel/route.ts`**: Consolidated duplicate imports of `conflict` and `notFound` from `@/lib/errors`.
