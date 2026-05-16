# Fix: Authentication & Security (AUTH-1–AUTH-5, SEC-1–SEC-4)

## Problem

The codebase had critical security gaps:
- All `/api/v1` routes were public (no JWT enforcement at middleware level)
- No admin JWT check on admin layout or routes
- Only 2 out of 5 required service token validators existed
- `PATCH /api/v1/payments/{id}/confirm` accepted service tokens from Buyer and Shipping (allowed other apps to override payment status)
- `POST /api/v1/payments/{id}/refund` had no auth whatsoever (Seller App calls this per docs)
- Admin layout rendered children without any authentication check

## Changes

### 1. `src/app/admin/layout.tsx` — Admin layout auth (SEC-2)

**Before**: Just rendered children — anyone could navigate to admin pages.

**After**: Enforces `publicMetadata.admin === true` via Clerk session. Redirects to `/sign-in` if user is not authenticated or not an admin.

```typescript
const session = await auth()
const claims = session?.sessionClaims as Record<string, unknown>
const publicMetadata = claims?.publicMetadata as Record<string, unknown>
const isAdmin = publicMetadata?.admin === true
if (!session?.userId || !isAdmin) redirect("/sign-in")
```

### 2. `src/app/api/v1/payments/[paymentId]/confirm/route.ts` — Fixed auth (SEC-4)

**Before**: Accepted `X-Service-Token` from Buyer App and Shipping App — allowing them to arbitrarily approve/reject payments without MP processing.

**After**: Uses `requireAdmin()` — only a Payments admin with valid Clerk JWT + admin flag can override payment status.

### 3. `src/app/api/v1/payments/[paymentId]/refund/route.ts` — Added auth (SEC-3)

**Before**: No auth at all. Anyone could call this endpoint.

**After**: Validates Seller service token via `validateServiceTokenSeller()` — only Seller App (with valid `X-Service-Token`) can initiate refunds.

### 4. `src/app/api/v1/payouts/route.ts` — Added admin auth (SEC-1)

**Before**: No auth on GET or POST handlers.

**After**: Both handlers call `requireAdmin()` before processing.

### 5. `src/app/api/v1/refunds/route.ts` — Added admin auth on GET (SEC-1)

**Before**: Only POST had `requireAdmin()`. GET had no auth (anyone could list all refunds).

**After**: GET also calls `requireAdmin()`.

### 6. `src/lib/service-token.ts` — Complete rewrite

**Before**: Only 2 validators: `validateServiceTokenBuyer`, `validateServiceTokenShipping`.

**After**: 5 validators for all documented pairs:
- `validateServiceTokenBuyer()`, `validateServiceTokenShipping()`, `validateServiceTokenSeller()`
- `validateServiceTokenPaymentsToBuyer()`, `validateServiceTokenPaymentsToSeller()`

All use a shared helper that checks against the corresponding env var.

### 7. `src/lib/admin-auth.ts` — Reusable requireAdmin()

Creates a reusable `requireAdmin()` function used by all admin endpoints.

### 8. Routes summary

| Route | Auth Before | Auth After |
|-------|-------------|------------|
| `GET /api/v1/payments` | None | None (server-to-server, consumed by Buyer) |
| `POST /api/v1/payments` | Buyer token | Buyer token ✓ |
| `PATCH /api/v1/payments/{id}/confirm` | Buyer/Shipping tokens | `requireAdmin()` |
| `POST /api/v1/payments/{id}/refund` | None | Seller token |
| `POST /api/v1/refunds` POST | requireAdmin | requireAdmin ✓ |
| `GET /api/v1/refunds` | None | requireAdmin |
| `GET /api/v1/payouts` | None | requireAdmin |
| `POST /api/v1/payouts` | None | requireAdmin |
| `POST /api/v1/receipts` | Buyer token | Buyer token ✓ |
| `/admin/*` pages | None | Admin layout auth |
