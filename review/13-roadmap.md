# Remediation Roadmap

**Dependency graph between fixes shown via → (must-fix-before)**

---

## Phase 1: Functional Core (Weeks 1–2)

### Week 1: Payment Pipeline

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 1.1 | Implement real MP API client (`mercado-pago.service.ts`) | None | `src/services/mercado-pago.service.ts` |
| 1.2 | Wire checkout preference creation into POST /payments | 1.1 | `src/app/api/v1/payments/route.ts` |
| 1.3 | Fix webhook signature validation (HMAC-SHA256) | None | `src/webhooks/mercadopago/route.ts` |
| 1.4 | Implement full webhook event processing | 1.1, 1.3 | `src/webhooks/mercadopago/route.ts` |
| 1.5 | Wire inter-app notifications (Buyer + Seller) | 1.4 | `src/services/inter-app-client.service.ts` |
| 1.6 | Fix settlement amount calculation in shipment-delivered | None | `src/app/api/v1/internal/shipment-delivered/route.ts` |
| 1.7 | Wire settlements creation into webhook flow | 1.4 | `src/services/settlement.service.ts` |
| 1.8 | Implement real MP refund call in refund routes | 1.1 | `src/app/api/v1/payments/[paymentId]/refund/route.ts` |

### Week 2: Auth & Payouts

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 2.1 | Implement Clerk JWT admin validation | None | `src/proxy.ts`, middleware |
| 2.2 | Add admin metadata check to admin layout/pages | 2.1 | `src/app/admin/layout.tsx` |
| 2.3 | Add service token validation to all endpoints | None | All route files |
| 2.4 | Add X-Service-Token validators for all pairs | None | `src/lib/service-token.ts` |
| 2.5 | Implement real MP transfer in payout flow | 1.1 | `src/app/api/v1/payouts/route.ts` |
| 2.6 | Add idempotency to all POST routes | None | All POST route files |
| 2.7 | Add X-Request-Id generation and propagation | None | `src/lib/axios.ts`, middleware |

#### Dependency Graph (Week 1-2)
```
1.1 → 1.2 → 1.5 → 1.7
  ↓    ↓
1.4 ← 1.3
  ↓
1.6

1.8 → (parallel with 2.5)

2.1 → 2.2
2.3 → (parallel with above)
2.5 → (needs 1.1)
```

---

## Phase 2: Correctness & Safety (Weeks 3–5)

### Week 3: State Machines & Validation

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 3.1 | Implement PaymentStateMachine with transition table | None | New: `src/lib/state-machines/payment.ts` |
| 3.2 | Apply state machine to payment status changes | 3.1 | All payment route files |
| 3.3 | Implement SettlementStateMachine | None | New: `src/lib/state-machines/settlement.ts` |
| 3.4 | Create Zod validation schemas for all request bodies | None | New: `src/validation/*.ts` |
| 3.5 | Apply Zod validation to all POST/PATCH routes | 3.4 | All route files |
| 3.6 | Implement error handling middleware | None | New: `src/middleware/error-handler.ts` |

### Week 4: API Completeness

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 4.1 | Add missing sort parameter support to list endpoints | None | Settlement, payment, payout routes |
| 4.2 | Add payment method verification to shipment-delivered | None | `src/app/api/v1/internal/shipment-delivered/route.ts` |
| 4.3 | Store items_summary on payment for later reference | 3.4 | `src/app/api/v1/payments/route.ts`, schema |
| 4.4 | Implement partial refund per-seller logic | 4.3 | Refund routes |
| 4.5 | Add rate limiting to API routes | None | New middleware |
| 4.6 | Standardize error response format across all routes | 3.6 | All routes |

### Week 5: Admin & UI

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 5.1 | Connect dashboard KPIs to real data | None | `src/app/admin/page.tsx` |
| 5.2 | Connect payouts table to real settlement amounts | None | `src/app/admin/payouts/page.tsx` |
| 5.3 | Wire quick date filters to payment queries | None | `src/app/admin/payments/page.tsx` |
| 5.4 | Implement batch payout retry endpoint | None | New: `src/app/api/v1/payouts/retry/route.ts` |
| 5.5 | Implement batch mark-settlements-paid endpoint | None | New: `src/app/api/v1/settlements/mark-paid/route.ts` |
| 5.6 | Fix receipt page display amounts | None | `src/app/admin/receipts/page.tsx` |
| 5.7 | Add soft-delete support to payout model | None | `prisma/schema.prisma` |

#### Dependency Graph (Week 3-5)
```
3.1 → 3.2 → 4.4
3.3 → (parallel)
3.4 → 3.5 → 4.3
3.6 → 4.6

4.1 → (no deps)
4.2 → (no deps)
4.5 → (no deps)

5.4, 5.5 → (no deps)
5.1, 5.2, 5.3 → (no deps)
```

---

## Phase 3: Quality & Infrastructure (Weeks 6–8)

### Week 6: Testing

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 6.1 | Set up Vitest + Testing Library + MSW | None | New config files |
| 6.2 | Test `calculateSettlementAmounts` | None | `src/services/settlement.service.ts` |
| 6.3 | Test `createSettlementsForPayment` | 6.2 | `src/services/settlement.service.ts` |
| 6.4 | Test state machine validation | 3.1, 3.3 | State machine files |
| 6.5 | Test webhook signature validation | 1.3 | Webhook route |
| 6.6 | Test API routes with MSW | 6.1 | All route files |
| 6.7 | Test inter-app notification service | None | `src/services/inter-app-client.service.ts` |

### Week 7: Architecture

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 7.1 | Create service layer for Payment operations | None | New: `src/services/payment.service.ts` |
| 7.2 | Create service layer for Settlement operations | None | New: `src/services/settlement.service.ts` |
| 7.3 | Refactor route handlers to use service layer | 7.1, 7.2 | All route files |
| 7.4 | Create repository abstraction layer | None | New: `src/repositories/*.ts` |
| 7.5 | Add structured logging (pino) | None | New: `src/lib/logger.ts` |
| 7.6 | Add request ID propagation | 7.5 | Middleware, all routes |

### Week 8: Observability & CI/CD

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 8.1 | Set up GitHub Actions CI workflow | None | `.github/workflows/ci.yml` |
| 8.2 | Add lint + typecheck + test to CI | 6.1, 8.1 | CI config |
| 8.3 | Add OpenAPI validation to CI | 8.1 | CI config |
| 8.4 | Add health check metrics endpoint | 7.5 | Health route |
| 8.5 | Add performance monitoring counters | 7.5 | All services |
| 8.6 | Clean up dead components | None | Remove unused files |

#### Dependency Graph (Week 6-8)
```
6.1 → 6.6
      6.2, 6.3, 6.4, 6.5 → (parallel)

7.1 → 7.3
7.2 → 7.3
7.4 → 7.3 (optional ideal)
7.5 → 7.6, 8.4, 8.5

8.1 → 8.2, 8.3
8.6 → (no deps)
```

---

## Phase 4: Polish (Weeks 9–10)

### Week 9: Schema & Data

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 9.1 | Add ID prefixes to all models | 3.4 | `prisma/schema.prisma`, new ID generator |
| 9.2 | Add `method` and `card_last4` fields to Payment | None | `prisma/schema.prisma` |
| 9.3 | Add missing Prisma enums | None | `prisma/schema.prisma` |
| 9.4 | Add `request_payload`/`response_payload` to PaymentAttempt | None | `prisma/schema.prisma` |
| 9.5 | Generate initial migration files | 9.1-9.4 | New migration files |

### Week 10: Security & Deployment

| Order | Task | Depends On | Files Affected |
|-------|------|------------|----------------|
| 10.1 | Add security headers to next.config.ts | None | `next.config.ts` |
| 10.2 | Add env var validation at startup | None | New: `src/lib/env.ts` |
| 10.3 | Create Docker Compose for local dev | None | New: `docker-compose.yml` |
| 10.4 | Create deployment docs / runbook | None | New: `deploy.md` |
| 10.5 | Implement retry-payment flow | 7.1 | New route |
| 10.6 | Audit and fix all `as any` casts | 7.4 | Multiple files |

#### Dependency Graph (Week 9-10)
```
9.1 → 9.5
9.2 → 9.5
9.3 → 9.5
9.4 → 9.5

10.1, 10.2, 10.3, 10.4 → (independent)
10.5 → 7.1
10.6 → (can be done incrementally)
```

---

## Full Dependency Graph

```
Phase 1 ─────────────────────────────────────────────────────────────┐
│ 1.1 ─→ 1.2 ─→ 1.5 ─→ 1.7                                          │
│  ↓       ↓                                                         │
│ 1.4 ←── 1.3                                                        │
│  ↓                                                                  │
│ 1.6                                                                 │
│ 1.8                                                                 │
│ 2.1 ─→ 2.2                                                         │
│ 2.3                                                                 │
│ 2.5 ─→ (needs 1.1)                                                 │
│ 2.6, 2.7                                                           │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
Phase 2 ─────────────────────────────────────────────────────────────┐
│ 3.1 ─→ 3.2 ─→ 4.4 (partial refunds)                               │
│ 3.3                                                                 │
│ 3.4 ─→ 3.5 ─→ 4.3 (store items_summary)                           │
│ 3.6 ─→ 4.6                                                         │
│ 4.1, 4.2, 4.5 (independent)                                        │
│ 5.1-5.6 (independent)                                               │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
Phase 3 ─────────────────────────────────────────────────────────────┐
│ 6.1 ─→ 6.6                                                         │
│ 6.2-6.5 (parallelizable)                                            │
│ 7.1 → 7.3                                                          │
│ 7.2 → 7.3                                                          │
│ 7.5 → 7.6, 8.4, 8.5                                               │
│ 8.1 → 8.2, 8.3                                                     │
│ 8.6                                                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
Phase 4 ─────────────────────────────────────────────────────────────┐
│ 9.1 → 9.5                                                         │
│ 9.2 → 9.5                                                         │
│ 9.3 → 9.5                                                         │
│ 9.4 → 9.5                                                         │
│ 10.1-10.4 (independent)                                            │
│ 10.5 → 7.1                                                         │
│ 10.6                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Recommended Testing Strategy

### Before Fixes

| Test Type | What to Test | Tool |
|-----------|-------------|------|
| Manual smoke | Create payment, check DB record | curl/Postman |
| Manual smoke | Trigger webhook with mock payload | curl |
| Manual smoke | Create refund via admin UI | Browser |

### After Each Phase

**After Phase 1:**
1. Unit test Mercado Pago service with mock HTTP
2. Unit test webhook signature validation
3. Integration test full payment flow (create → webhook → notification)
4. Integration test refund flow
5. Integration test settlement creation
6. Security test auth bypass on all endpoints

**After Phase 2:**
1. Unit test all state machines (every transition)
2. Property-based tests for invalid transitions
3. Integration test idempotency on all POST routes
4. Integration test error formatting on all routes
5. Integration test rate limiting

**After Phase 3:**
1. Full E2E flow with Playwright: sign in → view payments → create refund
2. Load test payment creation >100 concurrent requests
3. Chaos test: simulate MP API outage, verify retry behavior
4. Snapshot test all admin UI pages

**After Phase 4:**
1. Regression test all fixes
2. Security penetration test
3. Database migration test (roll forward and backward)

---

## Key Success Metrics

| Metric | Current | Target (Phase 1) | Target (Final) |
|--------|---------|-------------------|----------------|
| Test coverage | 0% | 40% (core paths) | 80%+ |
| TypeScript `any` usage | 15+ instances | <5 | 0 |
| Auth-gated endpoints | 0% | 100% | 100% |
| MP integration | 0% stubbed | 100% implemented | 100% |
| Error format consistency | ~30% | 100% | 100% |
| Hardcoded UI values | 4+ instances | 0 | 0 |
| Dead components | 8 | 0 | 0 |
| CI/CD pipeline | None | Tests + lint | Full pipeline |
