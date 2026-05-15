# UI Components & Admin Pages — Audit Findings

---

## Finding UI-1: Dead/Missing Backend Routes Called From Frontend

**Severity**: Critical | **Priority**: P0

**Documentation**: No documentation of batch endpoints — these are purely implementation issues.

**Code**: 
- `src/hooks/use-settlements.ts:58-59` — `useRetryPayouts` calls `POST /api/v1/payouts/retry`
- `src/hooks/use-settlements.ts:73-74` — `useMarkSettlementsPaid` calls `PATCH /api/v1/settlements/mark_paid`

**Problem**: Two frontend mutations call backend routes that DO NOT EXIST:
1. `/api/v1/payouts/retry` — Not implemented anywhere
2. `/api/v1/settlements/mark_paid` — Not implemented anywhere

When an admin clicks "Reintentar fallidos" or "Marcar como pagado", the request will fail with a 404.

**Root Cause**: Frontend hooks were written for planned features that were never implemented on the backend.

**Solution**: Either: 
1. Implement the batch retry/mark-paid backend routes, or
2. Remove the frontend actions and handle payouts individually

**Risk if ignored**: Admin actions silently fail with 404 errors, creating the illusion of functionality.

---

## Finding UI-2: Hardcoded Dashboard Data

**Severity**: Medium | **Priority**: P2

**Documentation**: docs describe dashboards for monitoring, but don't specify hardcoded data.

**Code**: `src/app/admin/page.tsx:77` — Sparkline data is hardcoded:
```typescript
<Spark data={[3, 4, 3, 5, 6, 5, 7, 6, 8, 9, 8, 10]} />
```
Also: KPI deltas are hardcoded: `+12.4%`, `+8.1%`, `−4`, `+5`.

**Problem**: The dashboard shows fake static data. The sparklines, percentage changes, and trends are not computed from actual data. The calendar filter buttons ("Últimos 30 días") are non-functional — they're just styled buttons with no onClick logic.

**Root Cause**: Dashboard was built as a mockup and never connected to real analytics.

**Solution**: Either:
1. Implement real KPI calculations from the database
2. Add an analytics table/query to compute trends over time
3. Wire the date filters to actually filter data
4. Or remove fake numbers and show meaningful "coming soon" placeholders

**Risk if ignored**: Admins get a false sense of marketplace health from fabricated metrics.

---

## Finding UI-3: Hardcoded Payout Amounts

**Severity**: Medium | **Priority**: P2

**Documentation**: Payout amounts should come from settlement data.

**Code**: `src/app/admin/payouts/page.tsx:118,166`
```typescript
<td className="num tnum" style={{ fontWeight: 500 }}>{ARS(2500000)}</td>
```

**Problem**: The payouts table displays `ARS 25.000,00` as the amount for every payout, regardless of the actual settlement amount. The real amount is available from `p.settlement.gross_amount_cents` (since the payout includes the settlement relation) but is ignored.

**Root Cause**: The static mockup was never replaced with real data binding.

**Solution**: Display the actual amount from the associated settlement: `p.settlement?.gross_amount_cents || 0`.

**Risk if ignored**: Admins see incorrect payout amounts, eroding trust in the system.

---

## Finding UI-4: Receipts Page Shows Fake Amount

**Severity**: Low | **Priority**: P3

**Code**: `src/app/admin/receipts/page.tsx:98`
```typescript
<td className="num tnum">{ARS(500000)}</td>  // Hardcoded amount
```

**Problem**: Same pattern as payouts — the receipt amount is hardcoded to 500000 instead of using `r.amount_cents`.

**Root Cause**: Same as UI-3.

**Solution**: Use `r.amount_cents` from the data.

**Risk if ignored**: Minor display issue.

---

## Finding UI-5: Date Quick Filters Don't Work

**Severity**: Medium | **Priority**: P2

**Code**: `src/app/admin/payments/page.tsx:17` — Quick filter state:
```typescript
const [quickFilter, setQuickFilter] = useState("7d")
```
But line 21 only uses `statusFilter` and `page`:
```typescript
const filters = useMemo<PaymentFilters>(
  () => ({ status: statusFilter || undefined, page, limit: 20 }),
  [statusFilter, page],
)
```

**Problem**: The "Hoy", "7 días", "30 días" quick filter buttons update state (`quickFilter`) that is NEVER used in the actual filter query. Clicking "Hoy" does nothing.

**Root Cause**: Quick filter state is isolated and never passed to the query.

**Solution**: Wire `quickFilter` to compute `from` and `to` date parameters and pass them to the payments query.

**Risk if ignored**: Filter buttons create the illusion of functionality but do nothing.

---

## Finding UI-6: Several Components Are Unused (Dead Code)

**Severity**: Low | **Priority**: P3

**Code**: Components that exist but are NOT imported anywhere:
- `src/components/admin/SettlementTable.tsx` — Imported by no page
- `src/components/admin/RefundDialog.tsx` — Imported by no page
- `src/components/admin/PaymentFilters.tsx` — Imported by no page
- `src/components/payments/PaymentsTable.tsx` — Imported by no page
- `src/components/payments/PaymentForm.tsx` — Imported by no page
- `src/components/onboarding/LoginAdminOnly.tsx` — Imported by no page
- `src/components/onboarding/LoadingStateMobile.tsx` — Exists but not imported
- `src/components/onboarding/EmptyStateMobile.tsx` — Exists but not imported

**Problem**: 8 components exist but are never referenced. They represent dead code that increases maintenance burden and creates confusion.

**Root Cause**: Components were created as part of an initial scaffold but never integrated, or were replaced by inline implementations in the actual pages.

**Solution**: Either integrate these components into the admin pages or remove them.

**Risk if ignored**: Codebase bloat and confusion for future developers.
