# Architectural & Design Findings

---

## F-ARCH01 — Missing Clerk lazy provisioning

**Severity**: High  
**Priority**: P2  
**Documentation**: `05-usuarios.md §3` (Sincronización Clerk → DB local)

**Code references**:
- `src/lib/admin-auth.ts` (only checks admin status, doesn't create profile)
- `src/app/admin/layout.tsx` (checks admin, doesn't provision)
- `src/proxy.ts` (no provisioning middleware)

**Problem**: The documentation clearly states:
> "En el middleware de auth de cada app, antes de pasarle el request al controller: Validar el JWT de Clerk → obtener clerk_user_id, email, full_name. Buscar el perfil local por clerk_user_id. Si no existe → crear."

Neither the Clerk middleware (`proxy.ts`) nor the admin layout (`admin/layout.tsx`) implements this. The `admin-auth.ts` `requireAdmin()` only checks authorization but never creates/upserts an admin profile.

**Root cause**: The provisioning layer was documented but never implemented.

**Recommended fix**:
1. Create a `withProfileProvisioning` middleware or add to `requireAdmin()`
2. On successful auth, upsert `AdminProfile` in the database
3. If the JWT has `publicMetadata.admin=true`, ensure profile exists

**Estimated complexity**: 4 hours

---

## F-ARCH02 — Missing `admin_profile` model in Prisma schema

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `05-usuarios.md §3.2` (crea admin_profile local)

**Code reference**: `prisma/schema.prisma` — no `AdminProfile` or `admin_profile` model exists.

**Problem**: The documentation says Payments App creates an `admin_profile` local record when an admin logs in. The Prisma schema has no such model.

**Recommended fix**: Add `AdminProfile` model with `id`, `clerk_user_id`, `email`, `full_name`, `created_at`, `updated_at`.

---

## F-ARCH03 — `proxy.ts` marks all API routes as public

**Severity**: Informational  
**Priority**: P3  
**Documentation**: `02-responsabilidades.md §2` (Auth rules)

**Code reference**: `src/proxy.ts` (lines 5-11)

**Problem**: The Clerk middleware explicitly excludes all `/api/v1(.*)` from authentication. While individual routes are expected to self-authenticate, this creates a fragile security model where forgetting auth on one route means it's fully exposed.

**Recommended fix**: Either:
1. Remove `/api/v1(.*)` from public routes and add proper Clerk JWT validation for all API calls, or
2. Create a route wrapper that enforces auth by default

---

## F-ARCH04 — No `X-Request-Id` propagation for outgoing notifications from webhook

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `02-responsabilidades.md §2` (Logs y trazabilidad)

**Code references**:
- `src/app/webhooks/mercadopago/route.ts` (reads `x-request-id` but doesn't propagate)
- `src/services/inter-app-client.service.ts` (generates new `X-Request-Id` per call)

**Problem**: The docs require `X-Request-Id` propagation in a chain. The webhook handler reads the incoming `x-request-id` but the inter-app client always generates a new one, breaking the trace chain.

**Recommended fix**: 
1. In the webhook handler, extract the incoming `X-Request-Id` 
2. Pass it to the notification functions
3. The inter-app client should accept an optional parent request ID

---

## F-ARCH05 — `src/app/test/` directory is empty

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `07-integracion-mercadopago.md §Paso 9` (references `src/app/test/checkout/page.tsx`)

**Code reference**: `src/app/test/` — empty directory. Actual checkout page is at `src/app/checkout/page.tsx`.

**Problem**: The docs reference a test checkout page at `/test/checkout` but it exists at `/checkout`. The routing path is different from what the documentation describes.

**Recommended fix**: Either move `checkout/page.tsx` to `test/checkout/page.tsx` or update the documentation.

---

## F-ARCH06 — `checkout-form.tsx` and `checkout/page.tsx` are near-duplicates

**Severity**: Medium  
**Priority**: P2  

**Code references**:
- `src/components/payments/checkout-form.tsx` (270 lines)
- `src/app/checkout/page.tsx` (117 lines)

**Problem**: Two implementations of the same checkout UI with slightly different styling and functionality:
- `checkout-form.tsx` is a reusable component with full seller group support
- `checkout/page.tsx` is a standalone page with hardcoded demo values

This duplication will diverge over time and confuses developers about which one to use.

**Recommended fix**: Make `checkout/page.tsx` use the `CheckoutForm` component. Remove the standalone rendering logic.

---

## F-ARCH07 — No `X-Service-Token` validation helper for `SHIPPING_APP_URL` in env.ts

**Severity**: Low  
**Priority**: P3  
**Documentation**: `03-apis.md §0.2`

**Code references**:
- `src/lib/env.ts` (missing `SHIPPING_APP_URL` from required vars)
- `src/lib/service-token.ts` (has validate functions)
- `src/.env.example` (has `SHIPPING_APP_URL`)

**Problem**: The `SHIPPING_APP_URL` env var is documented and in `.env.example` but `env.ts` doesn't validate its presence. The `inter-app-client.service.ts` only uses `BUYER_APP_URL` and `SELLER_APP_URL`, never `SHIPPING_APP_URL`.

**Recommended fix**: Add `SHIPPING_APP_URL` to `env.ts` required vars. Note: Payments doesn't currently call Shipping, so this may be intentional, but it should be documented.

---

## F-ARCH08 — Hardcoded fee percentage

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `01-descripcion.md §4.4` (fee is configurable per marketplace, default 10%)

**Code reference**: `src/services/settlement.service.ts` (line 8, `feePercentage = 10`)

**Problem**: The fee percentage is hardcoded to 10%. The docs say it should be configurable per marketplace (default 10%). This should be an environment variable or database setting.

**Recommended fix**: Add `MARKETPLACE_FEE_PERCENTAGE` env variable with fallback to 10.

---

## F-ARCH09 — Outbound calls log has no cleanup strategy

**Severity**: Low  
**Priority**: P3  
**Documentation**: `04-modelo-de-datos.md §4.1` (OutboundCallLog)

**Code reference**: `prisma/schema.prisma` (lines 266-281, `OutboundCallLog` model)

**Problem**: The `OutboundCallLog` table will grow unboundedly. No TTL, no archival, no cleanup mechanism.

**Recommended fix**: Add a cron job or cleanup endpoint to delete/archive records older than 90 days.

---

## F-ARCH10 — No `HttpMethod` enum for GET

**Severity**: Low  
**Priority**: P3  
**Documentation**: `prisma/schema.prisma` (lines 74-80, `HttpMethod` enum)

**Problem**: The `HttpMethod` enum in Prisma schema doesn't include a `GET` value, but `OutboundCallLog` records GET calls in the inter-app client. The code casts the method string to `HttpMethod` which will fail at runtime for GET requests.

**Root cause**: The enum was likely copied from a generic HTTP method list but GET was needed for the outbound log.

**Recommended fix**: Add `GET` to the `HttpMethod` Prisma enum.
