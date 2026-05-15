# Authentication & Security — Audit Findings

---

## Finding AUTH-1: All API v1 Routes Are Public (No JWT Enforcement)

**Severity**: Critical | **Priority**: P0

**Documentation**: `docs/02-responsabilidades.md §2` — Rules state:
- `Authorization: Bearer <JWT>` for UI calls
- `X-Service-Token: <secret>` for server-to-server calls

**Code**: `src/proxy.ts:7`
```typescript
const isPublicRoute = createRouteMatcher([
  "/api/v1(.*)",  // <--- All API v1 routes are public!
  ...
]);
```

**Problem**: The Clerk middleware marks ALL `/api/v1` routes as public. There is no JWT validation at the middleware level for any API endpoint. While some routes manually check `X-Service-Token`, there is zero enforcement of Clerk JWT authentication. An unauthenticated request can reach any endpoint.

**Root Cause**: The route matcher treats `/api/v1` as public, presumably because these endpoints are meant for server-to-server calls with `X-Service-Token`. However, there's no differentiation between endpoints that need JWT (admin UI) vs endpoints that need service tokens (inter-app).

**Solution**: 
1. Remove `/api/v1(.*)` from public routes
2. In each API route, apply appropriate auth: service token validation for inter-app endpoints, JWT validation for UI-served endpoints
3. For admin UI pages, keep JWT validation via Clerk middleware

**Risk if ignored**: Any unauthenticated actor can hit payment endpoints. While service tokens are checked on some routes, others (receipts, confirm, health) have no meaningful auth.

---

## Finding AUTH-2: No admin JWT Check on Admin Routes

**Severity**: Critical | **Priority**: P0

**Documentation**: `docs/05-usuarios.md §1` — "Payments App ... Todo JWT debe traer `publicMetadata.admin=true` o se rechaza con 401"

**Code**: 
- `src/proxy.ts` — Only checks if route is public or protected, doesn't check admin metadata
- `src/app/admin/layout.tsx` — Passes children through without any auth check
- `src/app/admin/page.tsx` — No auth validation on the component

**Problem**: The admin layout and pages have zero enforcement of the `publicMetadata.admin=true` requirement. Any authenticated Clerk user (even a buyer) could access `/admin` pages if they get past the minimal auth check. There's no code anywhere that reads `publicMetadata` from the JWT and verifies the admin flag.

**Root Cause**: The Clerk middleware integration was configured at a basic level without the admin metadata check specified in the docs.

**Solution**: 
1. In the Clerk middleware, check `auth().sessionClaims?.publicMetadata?.admin === true` for all admin routes
2. Create a reusable admin guard function/component
3. Add server-side checks on admin API routes

**Risk if ignored**: Non-admin users could potentially access sensitive payment operations like refunds, payouts, and settlements.

---

## Finding AUTH-3: X-Service-Token Validation Is Incomplete

**Severity**: High | **Priority**: P1

**Documentation**: `docs/02-responsabilidades.md §8` — Lists 16 inter-app communication pairs, each needing its own service token.

**Code**: `src/lib/service-token.ts:1-15`

```typescript
export function validateServiceTokenBuyer(token: string | null) { ... }
export function validateServiceTokenShipping(token: string | null) { ... }
```

**Problem**: Only TWO service token validators are implemented (Buyer→Payments and Shipping→Payments). Missing validators for:
- Seller→Payments (for settlements queries and refund requests)
- Payments→Buyer (for order status updates)
- Payments→Seller (for sales order creation and payment status updates)

Furthermore, none of these are used consistently. For instance:
- `POST /api/v1/payments/{paymentId}/confirm` has NO auth check at all
- `POST /api/v1/receipts` has no auth check
- `POST /api/v1/payments/{paymentId}/cancel` has no service token check

**Root Cause**: Token validation was implemented ad-hoc for the two inbound flows (Buyer and Shipping) but not for outbound calls or admin operations.

**Solution**:
1. Implement validators for all documented pairs
2. Apply service token validation to every server-to-server endpoint
3. For admin-endpoints that override payments (confirm) add both JWT admin check AND service token validation

**Risk if ignored**: Unauthorized apps could create settlements, confirm payments, or cancel transactions.

---

## Finding AUTH-4: Weak Admin Authentication on Refunds Endpoint

**Severity**: High | **Priority**: P1

**Documentation**: `docs/05-usuarios.md §2` — Admin operations require `publicMetadata.admin === true`.

**Code**: `src/app/api/v1/refunds/route.ts:70-76`
```typescript
const adminAuth = req.headers.get('authorization')?.startsWith('Bearer ')
if (!adminAuth) {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Admin authorization required' } },
    { status: 401 }
  )
}
```

**Problem**: The "admin check" only verifies the Authorization header starts with "Bearer " — it doesn't validate the JWT, check the signature, or verify `publicMetadata.admin=true`. Any request with `Authorization: Bearer anything` passes this check.

**Root Cause**: Clerk JWT verification was not integrated into this route. It's a placeholder guard.

**Solution**: Integrate proper Clerk JWT verification with admin metadata check.

**Risk if ignored**: Anyone can create refunds by sending a request with a fake Bearer token.

---

## Finding AUTH-5: X-Request-Id Header Not Implemented

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/02-responsabilidades.md §2.8` — "cada request inter-app lleva `X-Request-Id: <uuid>` que se propaga en cadena"

**Code**: 
- `src/services/inter-app-client.service.ts` — Does not generate or pass `X-Request-Id` header
- `src/lib/axios.ts` — No request interceptor for adding request IDs
- All API routes — No code reads or propagates `X-Request-Id`

**Problem**: The `X-Request-Id` header is not generated, sent, or logged anywhere. This breaks the entire traceability chain for debugging inter-app issues.

**Root Cause**: Never implemented despite being a documented requirement.

**Solution**: 
1. Add UUID generation in inter-app-client for every outbound call
2. Add Axios request interceptor to include `X-Request-Id` on all API calls
3. Log the request ID in all inbound request processing

**Risk if ignored**: Debugging distributed failures across apps becomes unnecessarily difficult.
