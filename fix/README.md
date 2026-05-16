# Implementation Fixes — Payments App (BiciMarket)

## Overview

This directory documents every change made to bring the Payments App repository into alignment with the canonical documentation in `docs/`.

## Index

| File | Review Findings Addressed | Description |
|------|--------------------------|-------------|
| `01-mercado-pago-integration.md` | MP-1–MP-4, WH-1 | Real MP API, HMAC-SHA256 webhook validation (with x-request-id fallback), refund/payout calls |
| `02-authentication-security.md` | AUTH-1–AUTH-5, SEC-1–SEC-4 | Service tokens, requireAdmin(), layout auth, confirm endpoint, endpoint hardening |
| `03-business-logic-fixes.md` | BL-1–BL-7, SET-1, REF-1, ST-1 | Settlement lifecycle fix, refund notifications, partial refunds, state machines, idempotency |
| `04-prisma-schema-changes.md` | DB-1–DB-6, INFRA-1, API-7 | Schema enums, missing fields, ID prefixes, IdempotencyKey model, error handler |
| `05-ui-and-code-quality.md` | UI-1–UI-6, TS-1–TS-2, API-5–API-6, PAG-1, DEAD-1 | Pagination next_cursor, PaymentStatus type, dead code removal, type fixes |

## Review Items Rejected

The following review items were evaluated and **rejected** as invalid or outdated:

1. **DB-3 (Soft delete on Settlement)**: Already has `deleted_at`, appropriate for financial audit trail — no change needed.

2. **AUTH-1 (All API routes public)**: By design — API routes authenticate internally via service tokens or admin JWT. Fixed by adding per-route auth, not by removing from public matcher.

3. **ARCH-1 (Service layer)**: Valid concern but deferred. Creating a service layer without tests introduces risk.

4. **BL-6 (Retry-payment flow)**: Docs mark this as "futuro" (future). Not implemented.

5. **Checkout Flow (MP API choice)**: `/checkout/preferences` vs `/v1/payments` is a documented choice. Both work. The code is correct as-is.

## Verification Required

Before deploying, run:

```bash
# Generate Prisma client + migrations (required for IdempotencyKey model)
npx prisma generate
npx prisma migrate dev --name add-idempotency-key

# Build
npm run build

# Verify admin auth works
curl http://localhost:3000/admin/payments -v  # Should redirect to /sign-in

# Verify idempotency
curl -X POST http://localhost:3000/api/v1/refunds \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-123" \
  -d '{"payment_id":"pay_...","amount_cents":1000,"reason":"manual"}'
```

## Architectural Decisions

### Why not a full service/repository layer?
The codebase has zero tests. Refactoring route handlers into abstracted layers without test coverage would introduce regressions. We prioritized:
1. Functional correctness
2. Auth/security
3. Type safety improvements
4. Service layer (deferred)

### Why generic IdempotencyKey table instead of per-model idempotency keys?
A dedicated `IdempotencyKey` table is clean, testable, and works across all models without modifying each model's schema individually. 24h TTL prevents unbounded growth.

### Why keep `as any` for Prisma enum casts?
Prisma's generated types for enum fields are complex TypeScript generics. Casting to `any` for dynamic operations is a known pragmatic pattern. Removal belongs in a dedicated type-safety phase.

### Why create settlements as `pending` on delivery (not `paid`)?
Per `docs/06-estados-y-diagramas.md §1.6` and `docs/01-descripcion.md §4.4`, settlements go through a lifecycle: `pending → paid` after the MP transfer completes. Creating as `paid` directly bypasses the transfer step.
