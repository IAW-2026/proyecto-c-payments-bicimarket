# Supplemental Findings (Phase 2 Audit)

Files covered: state machines, error handling, Prisma client, request-id, Zod schemas, type definitions, admin pages, payment components, hooks, admin components, health endpoint.

---

## F-SUP01 — Module-level mutable state in `admin-shell.tsx` leaks across SSR

**Severity**: High  
**Priority**: P1  
**Code reference**: `src/components/admin/admin-shell.tsx` (lines 11-12)

```typescript
let _sidebarOpen = false
let _firstVisit = true
```

**Problem**: Module-level mutable state in Next.js App Router is shared across all requests during Server-Side Rendering. When two users hit the admin at the same time, one user's sidebar state can leak to another. This also violates React's principle of no mutable shared state.

**Recommended fix**: Use React context, URL search params (`?sidebar=1`), or a Zustand store instead of module-level variables.

---

## F-SUP02 — `useRefundPayment` doesn't forward `seller_profile_id` to API

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/hooks/use-payments.ts` (lines 52-64)

```typescript
mutationFn: async ({ paymentId, amount_cents, reason }) => {
  const { data } = await axios.post(`/api/v1/payments/${paymentId}/refund`, {
    amount_cents, reason
  })
```

**Problem**: The mutation function accepts only `{ paymentId, amount_cents, reason }` but the `POST /payments/{id}/refund` endpoint also accepts `seller_profile_id`. The `refund-form.tsx` component sends it, but the hook never exposes it.

**Recommended fix**: Add `seller_profile_id` to the mutation input type and forward it to the API.

---

## F-SUP03 — `useCreateRefund` sends `payment_id` in body, but `useRefundPayment` passes it in URL

**Severity**: Informational  
**Priority**: P3  

**Code references**:
- `src/hooks/use-refunds.ts` (line 64): `axios.post('/api/v1/refunds', { payment_id, amount_cents, reason, seller_profile_id })`
- `src/hooks/use-payments.ts` (line 54): `axios.post('/api/v1/payments/${paymentId}/refund', { amount_cents, reason })`

**Problem**: Two hooks achieve the same thing (creating a refund) through different endpoints (`POST /refunds` vs `POST /payments/{id}/refund`). The `useCreateRefund` in `use-refunds.ts` includes `payment_id` in the body, while `useRefundPayment` in `use-payments.ts` uses the URL param. Both eventually call the same backend logic, but they have different interfaces, confusing developers.

**Recommended fix**: Consolidate into a single hook `useCreateRefund` that uses `POST /refunds`.

---

## F-SUP04 — No `useReceipts` hook; receipts page uses raw `useQuery`

**Severity**: Low  
**Priority**: P3  

**Code references**:
- `src/app/admin/receipts/page.tsx` (lines 28-37): raw `useQuery` instead of a dedicated hook
- `src/hooks/` — no `use-receipts.ts` exists

**Problem**: Every other admin page uses a dedicated hook (`usePayments`, `useSettlements`, `useRefunds`). The receipts page defines its query inline, leading to inconsistency and code duplication.

**Recommended fix**: Create `src/hooks/use-receipts.ts` with `useReceipts(filters)` and `useReceipt(receiptId)`.

---

## F-SUP05 — `RefundFilters` type defined inline in `use-refunds.ts` instead of `types/filters.ts`

**Severity**: Low  
**Priority**: P3  

**Code reference**: `src/hooks/use-refunds.ts` (lines 7-16)

**Problem**: `PaymentFilters` and `SettlementFilters` are in `src/types/filters.ts`, but `RefundFilters` and `PayoutFilters` (used in `use-settlements.ts`) are defined inline in their hook files. Inconsistent.

**Recommended fix**: Move `RefundFilters` and `PayoutFilters` to `src/types/filters.ts`.

---

## F-SUP06 — Admin dashboard fetches 100 records for KPI aggregation

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/app/admin/page.tsx` (lines 57-58)

```typescript
const payments = usePayments({ limit: 100 })
const settlements = useSettlements({ limit: 100 })
```

**Problem**: The dashboard fetches 100 payments and 100 settlements just to compute KPI aggregates (count, volume, sparkline data). This is wasteful bandwidth and processing. As data grows, 100 records will become insufficient for accurate aggregates.

**Recommended fix**: Add aggregation endpoints (`GET /api/v1/payments/stats` and `GET /api/v1/settlements/stats`) that return server-computed KPIs (count, volume, trends) and sparkline data.

---

## F-SUP07 — Admin refund page uses raw inline dialog instead of shadcn Dialog

**Severity**: Low  
**Priority**: P3  

**Code reference**: `src/app/admin/refunds/page.tsx` (lines 186-254)

**Problem**: The refund page implements its own dialog with raw `<div className="dialog-backdrop">` and custom styles, while the `refund-form.tsx` component uses the proper shadcn `<Dialog>` component. Two different implementations for the same UI pattern.

**Recommended fix**: Reuse `<RefundForm>` component in the admin refunds page instead of the raw dialog.

---

## F-SUP08 — Admin refund list uses `confirm()` which blocks UI thread

**Severity**: Low  
**Priority**: P3  

**Code reference**: `src/app/admin/payments/[id]/page.tsx` (line 65)

```typescript
if (!confirm(`¿Reembolsar ${ARS(d.amount_cents)} del pago ${d.id}?`)) return
```

**Problem**: The native `confirm()` dialog blocks the main thread and is unstyled. Refunds are destructive actions and should use a proper modal dialog consistent with the rest of the app (like the shadcn Dialog used in `refund-form.tsx`).

**Recommended fix**: Use the `<RefundForm>` component instead of the inline confirm+refund logic.

---

## F-SUP09 — `InvalidTransitionError` defined in `payment.ts` but imported by `settlement.ts`

**Severity**: Informational  
**Priority**: P3  

**Code reference**: `src/lib/state-machines/settlement.ts` (line 1: imports from payment.ts)

**Problem**: `InvalidTransitionError` is defined in `payment.ts`'s state machine but used by both `payment.ts` and `settlement.ts`. This creates a spurious dependency: the settlement state machine imports from the payment state machine for error handling, not for transition logic.

**Recommended fix**: Extract `InvalidTransitionError` into a shared module (`src/lib/errors.ts` already exists and handles it).

---

## F-SUP10 — `payment.ts` state machine exports `PaymentStatus` type that conflicts with `types/payments.ts`

**Severity**: Low  
**Priority**: P3  

**Code references**:
- `src/lib/state-machines/payment.ts` (line 1): `export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refused'`
- `src/types/payments.ts` (line 1): `export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'`

**Problem**: The state machine uses `refused` while the types file uses `refunded`. Wait, let me re-read... `payment.ts` line 1 says `refunded`. Let me verify...

Actually reading again: `src/lib/state-machines/payment.ts` line 1:
```
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'
```

And `src/types/payments.ts` line 1:
```
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'
```

They're identical. So this finding is invalid. Let me remove it.

---

## F-SUP11 — Prisma auto-ID uses `generateId(model)` but model naming convention is unclear

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/lib/prisma.ts` (lines 12-17), `src/lib/id-generator.ts`

**Problem**: The Prisma client auto-generates IDs via middleware that calls `generateId(model)` where `model` is the Prisma model name (PascalCase, e.g., `Payment`). But the `generateId` function in `id-generator.ts` uses a truncated UUID with no model-specific prefix:

```typescript
function shortId(): string { return crypto.randomUUID().replace(/-/g, '').slice(0, 20) }
```

The documentation requires per-model prefixes (`pay_`, `set_`, `ref_`, `pout_`, etc.), but the actual implementation has no prefix. The `generateId` function receives the model name but doesn't use it to determine a prefix. See also F-DM01.

**Recommended fix**: Implement model-to-prefix mapping in `generateId()`:
```typescript
const PREFIXES: Record<string, string> = {
  Payment: 'pay_', PaymentSettlement: 'set_', Refund: 'ref_',
  Payout: 'pout_', Receipt: 'rec_', PaymentAttempt: 'patt_',
  OutboundCallLog: 'log_', MpWebhookEvent: 'wh_',
}
```

---

## F-SUP12 — `Payment` type missing `deleted_at` field

**Severity**: Low  
**Priority**: P3  

**Code reference**: `src/types/payments.ts` (lines 8-24), `prisma/schema.prisma` (Payment model has `deleted_at DateTime?`)

**Problem**: The Prisma schema includes `deleted_at DateTime?` on the Payment model for soft deletes, but the TypeScript `Payment` type doesn't include it. TypeScript consumers won't know about soft delete support.

**Recommended fix**: Add `deleted_at?: string` to the `Payment` type.

---

## F-SUP13 — `MpWebhookEvent` payload typed as `any`

**Severity**: Low  
**Priority**: P3  
**Code reference**: `src/types/payments.ts` (line 75: `payload: any`)

**Problem**: The webhook event payload is typed as `any`, defeating TypeScript's type checking for webhook processing. This is the central data type for the MP integration.

**Recommended fix**: Create a proper type for MP webhook payloads:
```typescript
export interface MpWebhookPayload {
  action: string
  api_version: string
  data: { id: string }
  date_created: string
  id: number
  live_mode: boolean
  type: 'payment' | 'plan' | 'subscription' | ...
  user_id: string
}
```

---

## F-SUP14 — Health endpoint returns 200 even when database is down

**Severity**: Low  
**Priority**: P3  
**Code reference**: `src/app/api/health/route.ts` (line 19-22)

**Problem**: The health endpoint always returns `{ status: 'ok' }` with HTTP 200, even when `checks.database.ok` is `false`. Downstream consumers (load balancers, Kubernetes) may not probe the internal `checks` object, assuming the service is healthy when the database is actually down.

**Recommended fix**: Return HTTP 503 when `checks.database.ok` is `false`.

---

## F-SUP15 — Admin payouts page filters data client-side instead of server-side

**Severity**: Low  
**Priority**: P3  
**Code reference**: `src/app/admin/payouts/page.tsx` (lines 27-32)

```typescript
const failed = payouts.filter((p) => p.status === 'failed' || p.status === 'manual_review')
const scheduled = payouts.filter((p) => p.status === 'pending')
const inProgress = payouts.filter((p) => p.status === 'in_progress')
const completed = payouts.filter((p) => p.status === 'completed')
```

**Problem**: The payouts page fetches ALL payouts via API (with pagination) but then filters client-side by status. The API already supports `?status=` filtering. This means even if you're looking at "completed" tab, the API returns pending/in-progress/failed/completed in the same page.

**Recommended fix**: Add `status` param to the API call when a tab is selected, so the server returns only relevant records.

---

## F-SUP16 — No dedicated `useReceipt` hook; receipt detail page doesn't exist

**Severity**: Low  
**Priority**: P3  

**Code reference**: `src/app/admin/receipts/[id]/` — does not exist

**Problem**: All other entities (payments, settlements, refunds) have a detail route (`[id]/page.tsx`). Receipts only have a list page with no detail view. The receipt detail endpoint `GET /api/v1/receipts/{id}` exists but nothing calls it.

**Recommended fix**: Add `src/app/admin/receipts/[id]/page.tsx` and `useReceipt(receiptId)` hook.
