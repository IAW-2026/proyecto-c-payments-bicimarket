# Remediation Roadmap

## Phase 1 — Critical Security & Correctness (Week 1)

```
Priority: P0
Dependency: None
Effort: ~34h
```

### Step 1.0 — Fix admin SSR state leak
- **Files affected**: `src/components/admin/admin-shell.tsx`
- **Action**: Replace module-level `let _sidebarOpen = false` with React context or Zustand store
- **Verification**: Load admin on two browser tabs simultaneously — sidebar state is independent

### Step 1.1 — Authentication on all API routes
- **Files affected**: `src/app/api/v1/payments/route.ts`, `src/app/api/v1/settlements/route.ts`, `src/app/api/v1/receipts/route.ts`, `src/app/api/v1/receipts/[receiptId]/route.ts`, `src/app/api/v1/payouts/route.ts`, `src/app/api/v1/refunds/route.ts`, `src/app/api/v1/settlements/[settlementId]/route.ts`, `src/app/api/v1/payments/[paymentId]/route.ts`, `src/app/api/v1/payments/[paymentId]/cancel/route.ts`
- **Action**: Add `requireAdmin()` or service token validation to every route handler
- **Verification**: Attempt to call each endpoint without credentials → must return 401/403

### Step 1.2 — Complete webhook payment flow
- **Files affected**: `src/services/mp-webhook-processor.ts`, `src/services/inter-app-client.service.ts`
- **Action**: After `paymentStatus === 'approved'`, call `notifyBuyerOrderStatus()` and `createSellerSalesOrder()` for each seller in `items_summary`
- **Dependency**: Need working `BUYER_APP_URL` and `SELLER_APP_URL` env vars
- **Verification**: Unit test with mock payment → assert inter-app calls were made

### Step 1.3 — Implement MP transfer execution
- **Files affected**: `src/services/settlement.service.ts`, `src/app/api/v1/payouts/route.ts`, `src/services/mercado-pago.service.ts`
- **Action**: Create `createTransfer()` in `mercado-pago.service.ts`. After payout creation, call MP transfers API. Update payout status based on MP response.
- **Verification**: Integration test with sandbox credentials

### Step 1.4 — Fix settlement lifecycle in shipment-delivered
- **Files affected**: `src/app/api/v1/internal/shipment-delivered/route.ts`
- **Action**: Always create settlement as `pending` (never `paid`). Remove premature `validateSettlementTransition(settlement.status, 'paid')` when creating. Only mark `paid` after payout succeeds.
- **Verification**: Assert settlement created with `status=pending`

---

## Phase 2 — API Contract & State Machine Alignment (Week 2)

```
Priority: P1
Depends on: Phase 1
Effort: ~24h
```

### Step 2.1 — Fix idempotency response shapes
- **Files affected**: `src/lib/idempotency.ts`, `src/app/api/v1/payments/route.ts`
- **Action**: Ensure idempotency-cached response has identical shape to normal response
- **Verification**: Multiple requests with same key → identical responses

### Step 2.2 — Fix `POST /api/v1/payments` response
- **Files affected**: `src/app/api/v1/payments/route.ts`
- **Action**: Change response to match documented format: `{ id, order_id, amount_cents, currency, status, checkout_url, gateway_reference, created_at }`
- **Verification**: Compare against `03-apis.md` §P1 response spec

### Step 2.3 — Fix state machine transitions
- **Files affected**: `src/app/api/v1/settlements/mark_paid/route.ts`, `src/app/api/v1/refunds/[refundId]/route.ts`, `src/app/api/v1/internal/shipment-delivered/route.ts`
- **Action**: Add `validateSettlementTransition()` / `validatePaymentTransition()` calls to all endpoints that change status
- **Verification**: Attempt invalid transitions → 409 error

### Step 2.4 — Deduplicate refund logic
- **Files affected**: `src/app/api/v1/payments/[paymentId]/refund/route.ts`, `src/app/api/v1/refunds/route.ts`
- **Action**: Extract shared refund processing into `src/services/refund.service.ts`
- **Verification**: Both routes produce identical refund behavior

---

## Phase 3 — Testing & Reliability (Week 2-3)

```
Priority: P0-P1
Depends on: Phase 1-2
Effort: ~40h
```

### Step 3.1 — Unit tests for core services
- Create `src/services/__tests__/mercado-pago.service.test.ts`
- Create `src/services/__tests__/settlement.service.test.ts`
- Create `src/lib/state-machines/__tests__/payment.test.ts`
- Create `src/lib/state-machines/__tests__/settlement.test.ts`

### Step 3.2 — Integration tests for API routes
- Test `POST /api/v1/payments` with idempotency
- Test `POST /webhooks/mercadopago` with valid/invalid signatures
- Test `POST /api/v1/internal/shipment-delivered`
- Test `POST /api/v1/payments/{id}/refund`

### Step 3.3 — Retry mechanism tests
- Test failed payout retry logic
- Test 3 retries → `manual_review` transition

---

## Phase 4 — Completeness & Observability (Week 3-4)

```
Priority: P2
Depends on: Phase 2-3
Effort: ~16h
```

### Step 4.1 — Implement Clerk lazy provisioning
- **Files affected**: `src/lib/admin-auth.ts`, new middleware
- **Action**: On login, upsert `admin_profile` based on JWT claims

### Step 4.2 — Add proper logging and monitoring
- **Files affected**: `src/lib/outbound-logger.ts` (new)
- **Action**: Ensure all outbound calls are logged to `OutboundCallLog`

### Step 4.3 — Data migration for missing models
- **Files affected**: `prisma/schema.prisma`
- **Action**: Add `AdminProfile` model

### Step 4.4 — Add pagination cleanup
- **Files affected**: `src/app/api/v1/*/route.ts`
- **Action**: Ensure `next_cursor` is properly implemented

### Step 4.5 — Consolidate hooks and types
- **Files affected**: `src/hooks/use-payments.ts`, `src/hooks/use-refunds.ts`, `src/hooks/use-settlements.ts`, `src/types/filters.ts`
- **Action**: Move `RefundFilters` and `PayoutFilters` to `types/filters.ts`. Create `useReceipts` hook. Fix `useRefundPayment` to forward `seller_profile_id`. Consolidate refund hooks to single path.
- **Verification**: All admin pages work with no TypeScript errors

### Step 4.6 — Fix Prisma auto-ID prefix generation
- **Files affected**: `src/lib/id-generator.ts`, `src/lib/prisma.ts`
- **Action**: Map Prisma model names to documented prefixes (`pay_`, `set_`, `ref_`, etc.)
- **Verification**: Created records have correct prefix in their IDs

---

## Dependency Graph

```
Phase 1 (Security + Core Flow)
  ├── Step 1.0 (Admin SSR fix) → independent
  ├── Step 1.1 (Auth) → blocks Phase 2
  ├── Step 1.2 (Webhook Flow) → blocks Phase 2
  ├── Step 1.3 (Transfers) → blocks Phase 2
  └── Step 1.4 (Settlement Lifecycle) → blocks Phase 2
        │
Phase 2 (Contracts + States)
  ├── Step 2.1 (Idempotency) → blocks Phase 3 testing
  ├── Step 2.2 (Response shapes) → blocks Phase 3 testing
  ├── Step 2.3 (State machines) → blocks Phase 3 testing
  └── Step 2.4 (Refund dedup) → can be parallel
        │
Phase 3 (Testing)
  └── Steps 3.1-3.3 → can be blocked by Phase 1-2
        │
Phase 4 (Polish)
  ├── Step 4.1 (Clerk) → independent
  ├── Step 4.2 (Logging) → independent
  ├── Step 4.3 (Migration) → independent
  ├── Step 4.4 (Pagination) → independent
  ├── Step 4.5 (Hooks/Types) → after QA
  └── Step 4.6 (ID prefixes) → after QA
```

## Testing Strategy

### Before Fixes
- Manual integration testing via `checkout/page.tsx` with sandbox MP
- No automated tests exist
- Risk: changes break undocumented behavior

### During Fixes
- Add unit tests for every new/modified service function
- Add state machine tests for all documented transitions
- Add API route tests with mocked Prisma + MP

### After Fixes
- Full `npm run build` must pass
- E2E: create payment → webhook → settlement → payout flow
- All documented API contract tests pass
- Auth tests: every route returns proper error codes
