# API Routes — Audit Findings

---

## Finding API-1: Missing Endpoint Sort Parameter Support

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/03-apis.md §0.4` — "Querystring: `?page=1&limit=20&sort=-created_at&q=...`"

**Code**: Only the `GET /api/v1/refunds` route parses a `sort` parameter. All other list endpoints (payments, settlements, payouts, receipts) ignore the sort parameter and hardcode `orderBy: { created_at: 'desc' }`.

**Problem**: Clients cannot sort results by different fields. The sorting is always by `created_at` descending.

**Root Cause**: Sort parameter parsing was implemented only in the refunds route as a partial implementation.

**Solution**: Add consistent sort parameter parsing across all list endpoints. Support `-field` for descending and `field` for ascending.

**Risk if ignored**: Reduced API usability, but not blocking.

---

## Finding API-2: Receipt POST Has No Auth

**Severity**: High | **Priority**: P1

**Documentation**: `docs/03-apis.md §P2` — Receipt endpoints are server-to-server (should require `X-Service-Token`).

**Code**: `src/app/api/v1/receipts/route.ts:44-91` — POST /api/v1/receipts has no auth validation at all.

**Problem**: Anyone can create receipts with arbitrary data. No service token or JWT check.

**Root Cause**: Auth was never added to this route.

**Solution**: Add `X-Service-Token` validation on POST /api/v1/receipts (should validate the same token as other internal endpoints).

**Risk if ignored**: Unauthenticated receipt creation could be used to inject fraudulent data.

---

## Finding API-3: Confirm Endpoint Has No Auth

**Severity**: High | **Priority**: P1

**Documentation**: `docs/03-apis.md §P1` — PATCH /api/v1/payments/{paymentId}/confirm is "server-to-server, admin override"

**Code**: `src/app/api/v1/payments/[paymentId]/confirm/route.ts` — No auth validation whatsoever.

**Problem**: The admin override endpoint — arguably the most dangerous endpoint in the system (can force any payment to approved or rejected) — has zero authentication. Any request can change payment statuses.

**Root Cause**: Auth was forgotten during implementation.

**Solution**: Add both:
1. `X-Service-Token` validation (for server-to-server automation)
2. Clerk JWT with `publicMetadata.admin=true` check (for admin UI usage)

**Risk if ignored**: Any network actor can approve fake payments, causing the marketplace to fulfill orders without real money.

---

## Finding API-4: POST /api/v1/settlements Should Not Be Externally Callable

**Severity**: High | **Priority**: P1

**Documentation**: `docs/03-apis.md §P3` — "Lo dispara Payments App internamente al recibir `shipment-delivered`"

**Code**: `src/app/api/v1/settlements/route.ts:58-88` — POST /api/v1/settlements is exposed and validates `SHIPPING_TO_PAYMENTS_SERVICE_TOKEN`.

**Problem**: According to the docs, settlement creation is an internal trigger, not something Shipping App should call directly. The documented flow is:
1. Shipping calls `POST /api/v1/internal/shipment-delivered`
2. Payments processes internally and creates settlements

Yet here, an external POST endpoint is exposed for creating settlements directly. The `shipment-delivered` route also creates settlements. This is a dual-path inconsistency.

**Root Cause**: The settlement creation endpoint was designed as a direct API for other apps to call, contradicting the documented internal-trigger approach.

**Solution**: Either:
- Remove the POST /settlements route entirely (settlements are created internally)
- Or update the docs to match the actual implementation
Keep the service token validation either way.

**Risk if ignored**: Confusion about which path creates settlements leads to duplicates or missed settlements.

---

## Finding API-5: Payout Response Status Code Is Wrong

**Severity**: Low | **Priority**: P3

**Documentation**: `docs/03-apis.md §P3` — POST /api/v1/payouts should return **202 Accepted**.

**Code**: `src/app/api/v1/payouts/route.ts` — Returns **201 Created**.

**Problem**: The documented status code is 202 (accepted for async processing), but the implementation returns 201 (created synchronously).

**Root Cause**: Mismatch between documentation and implementation.

**Solution**: Change response status to 202 to indicate async processing (since the MP transfer happens asynchronously).

**Risk if ignored**: Client code expecting 202 will break.

---

## Finding API-6: Payments POST Response Missing Expected Fields

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/03-apis.md §P1` — POST /api/v1/payments response includes:
```json
{
  "checkout_url": "https://www.mercadopago.com.ar/...",
  "gateway_reference": "mp_pref_2426354"
}
```

**Code**: `src/app/api/v1/payments/route.ts:109`
```typescript
return NextResponse.json({ data: { ...payment } }, { status: 201 })
```

**Problem**: The response returns just the stored payment object — no `checkout_url`, no `gateway_reference`, no `method`. Buyer App needs the `checkout_url` to redirect the customer to MP.

**Root Cause**: Direct consequence of the MP integration not being implemented (MP-1).

**Solution**: After creating the MP checkout preference (which needs to be implemented), include `checkout_url` and `gateway_reference` in the response.

**Risk if ignored**: Buyer App has nowhere to redirect the customer for payment.

---

## Finding API-7: Error Response Format Inconsistency

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/03-apis.md §0.3` — Standard error format:
```json
{
  "error": { "code": "...", "message": "...", "details": {} }
}
```

**Code**: Multiple routes have inconsistent error formats:
- Some return proper `{ error: { code, message } }` format
- Others may return different structures
- Some use `console.error` + generic 500 without structured error
- No route uses the full `details` field consistently

**Problem**: Error responses are not standardized, making client-side error handling unreliable.

**Root Cause**: No shared error-handling middleware or utility was created.

**Solution**: Create a shared error handling utility that:
1. Standardizes all error responses
2. Includes appropriate HTTP status codes
3. Populates `code`, `message`, and optionally `details`
4. Applies to all routes

**Risk if ignored**: Client apps (Buyer, Seller) cannot reliably parse errors.

---

## Finding API-8: Missing Health Check Details

**Severity**: Low | **Priority**: P3

**Documentation**: No explicit docs for health check, but the route exposes partial DATABASE_URL prefix.

**Code**: `src/app/api/health/route.ts:17`
```typescript
urlPrefix: process.env.DATABASE_URL?.slice(0, 25)
```

**Problem**: The health endpoint leaks the first 25 characters of `DATABASE_URL` in error responses. While the password part of a standard PostgreSQL URL comes after the colon, this could still leak sensitive information like hostnames.

**Root Cause**: Security oversight in the health check implementation.

**Solution**: Remove `urlPrefix` from the error response. Only expose `hasUrl: boolean`.

**Risk if ignored**: Low, but represents unnecessary information disclosure.
