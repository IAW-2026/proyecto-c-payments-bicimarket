# Engineering Audit — Payments App (BiciMarket)

## Executive Summary

This repository implements the **Payments App** domain of the BiciMarket marketplace — responsible for payment processing via Mercado Pago, settlement splitting per seller, refunds, and payout tracking. The codebase is built with Next.js 16, Prisma (PostgreSQL), Clerk for admin auth, and TanStack Query for frontend state management.

**Overall Architectural Health Assessment: CRITICAL**

The project has a solid documentation foundation (7 detailed spec docs) but the implementation is severely incomplete and misaligned. Approximately **40-50% of the documented features are missing, partially implemented, or incorrectly implemented.** The codebase appears to be in early development stage with significant gaps in business logic, security, error handling, and inter-app communication.

**Audit coverage**: 11 core finding files + 1 supplemental file. ~77 source files reviewed total (15 API routes, 5 services, 7 infra/lib files, 8 admin pages, 7 type/definition files, 5 hooks, 4 payment components, 5 admin components, 3 state machine files, 1 health endpoint, and cross-references to Prisma schema, env, and proxy config).

## Main Risks

1. **Webhook processing is incomplete** — The MP webhook processor updates local payment status but **never notifies Buyer or Seller apps** via REST calls, breaking the entire cross-app communication chain.
2. **No authentication on most API routes** — Critical endpoints like `GET /api/v1/payments` and `GET /api/v1/settlements` have zero auth, exposing financial data.
3. **MP transfers not executed** — Settlements are created but `POST /v1/transfers` to Mercado Pago is never called, meaning sellers would never get paid.
4. **Broken idempotency contract** — Responses returned by idempotency cache have different shapes than normal responses.
5. **Zero test coverage** — No tests exist for any component, service, route, or integration.
6. **Duplicate code** — Refund logic is duplicated across two routes with subtle differences.
7. **Misaligned API responses** — Several endpoints return different shapes than documented.
8. **State machine violations** — Several routes bypass documented transition validations.
9. **Clerk provisioning not implemented** — Documented lazy provisioning pattern is absent.
10. **Empty `test/` directory** — Documented test checkout page doesn't exist at expected path.

## Top 10 Critical Problems

| # | Problem | Severity | Priority | Area |
|---|---------|----------|----------|------|
| 1 | Webhook processor doesn't notify Buyer/Seller apps after payment approval | Critical | P0 | `mp-webhook-processor.ts` |
| 2 | No MP transfer execution — sellers never receive funds | Critical | P0 | `payouts/route.ts`, `settlement.service.ts` |
| 3 | Most GET endpoints have zero authentication | Critical | P0 | Multiple API routes |
| 4 | Broken idempotency response shapes | High | P1 | `payments/route.ts`, `idempotency.ts` |
| 5 | `POST /api/v1/payments` response format doesn't match docs | High | P1 | `payments/route.ts` |
| 6 | Duplicated refund logic with inconsistencies | High | P1 | `payments/[id]/refund/route.ts`, `refunds/route.ts` |
| 7 | Settlement auto-marked as `paid` bypassing payout flow | Critical | P0 | `internal/shipment-delivered/route.ts` |
| 8 | No retry mechanism for failed payouts/transfers | High | P1 | `payouts/route.ts` |
| 9 | Missing `admin_profile` model and Clerk provisioning | High | P2 | Prisma schema, `admin-auth.ts` |
| 10 | Zero tests across entire codebase | Critical | P0 | — |

## Estimated Effort to Stabilize

| Effort Category | Estimated Hours | Dependencies |
|----------------|----------------|------------|
| Fix critical security (auth on routes) | 8h | None |
| Complete webhook → inter-app notification flow | 16h | Inter-app client fixes |
| Implement MP transfer execution | 8h | Settlement service |
| Fix API response contracts | 4h | Schema/types alignment |
| Add tests (unit + integration) | 40h | All fixes above |
| Implement Clerk provisioning | 4h | Auth middleware |
| Deduplicate refund logic | 4h | Route refactor |
| Add retry mechanisms | 8h | Settlement/payout logic |
| Fix admin SSR state leak (F-SUP01) | 2h | None |
| Consolidate hooks and types | 4h | Types cleanup |
| Fix remaining medium issues | 16h | Various |
| **Total** | **~114h** | — |

## Recommended Implementation Order

1. **P0 Security** — Add auth to all unprotected routes
2. **P0 Webhook Flow** — Complete the payment approval → notify Buyer/Seller chain
3. **P0 Transfers** — Implement actual MP transfer calls
4. **P0 Testing** — Add core tests for payment creation, webhook, settlement
5. **P1 API Contracts** — Fix response shapes to match documentation
6. **P1 State Machines** — Enforce transitions everywhere
7. **P1 Retry Logic** — Add exponential backoff for payouts
8. **P1 Admin Fix** — Fix module-level state in `admin-shell.tsx` (SSR leak)
9. **P2 Cleanup** — Deduplicate, fix provisioning, add observability, consolidate hooks/types
10. **P3 Polish** — UI consistency, error messages, logging, receipt detail page
