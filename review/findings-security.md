# Security Findings

---

## F-SEC01 — Exposed API keys in `.env` file committed to repository

**Severity**: High  
**Priority**: P0  
**Documentation**: Standard security best practices

**Code reference**: `.env` (committed to repository with live production credentials)

**Evidence**: The `.env` file contains:
- Production `MERCADOPAGO_ACCESS_TOKEN=APP_USR-8845082756580582-052816-...`
- Production `MERCADOPAGO_PUBLIC_KEY=APP_USR-53cec40a-...`
- Production `MERCADOPAGO_WEBHOOK_SECRET=8e6600c75b10289...`
- Supabase database URL with password `H3C9eVD4GjIuRO1z@`
- Clerk secret keys `sk_test_...`
- All service tokens (though currently dummy values)

**Risk**: Live production credentials are exposed in the repository. Anyone with access to the repo can:
- Create payments, process refunds, transfer funds via MP
- Access Clerk admin APIs
- Connect to the production database

**Recommended fix**:
1. **Immediately** rotate ALL credentials:
   - Mercado Pago `ACCESS_TOKEN`, `PUBLIC_KEY`, `WEBHOOK_SECRET`
   - Clerk `SECRET_KEY`
   - Supabase database password
2. Remove `.env` from the repository (add to `.gitignore` — it's already listed but the file was committed anyway)
3. Use `git-secrets` or similar pre-commit hook to prevent credential leaks
4. Add `dotenv` linting in CI

**Note**: The `.env` file has both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` entries duplicated and actual Secrets interspersed with examples.

---

## F-SEC02 — `GET /api/v1/payments` exposes all payment data without auth

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `03-apis.md §0.2`

**Code reference**: `src/app/api/v1/payments/route.ts` (GET handler, no auth)

**Problem**: The endpoint lists all payments with full details (amount, buyer, status, etc.) with zero authentication. No JWT check, no service token check.

**Recommended fix**: Add `requireAdmin()` to GET handler.

---

## F-SEC03 — `GET /api/v1/settlements` exposes seller financial data without auth

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `03-apis.md §P3`

**Code reference**: `src/app/api/v1/settlements/route.ts`

**Problem**: Settlement data includes gross amounts, fees, and net amounts per seller. No authentication on the GET endpoint.

**Recommended fix**: Add `requireAdmin()` or service token validation.

---

## F-SEC04 — `GET /api/v1/receipts/{id}` exposes receipt data without auth

**Severity**: High  
**Priority**: P1  
**Code reference**: `src/app/api/v1/receipts/[receiptId]/route.ts`

**Problem**: Receipts contain payment amounts and links to PDF receipts. No auth.

---

## F-SEC05 — No input sanitization on stored JSON fields

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `prisma/schema.prisma` — `items_summary Json?`, `request_payload Json?`, `response_payload Json?`

**Problem**: Several models store raw JSON from external sources (MP payloads, request bodies) without sanitization. If the admin UI renders these values (e.g., in a detail page), it could be vulnerable to stored XSS.

**Recommended fix**: Sanitize JSON payloads before storage, or only store specific known fields.

---

## F-SEC06 — Service tokens stored in `.env` have no rotation mechanism

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `02-responsabilidades.md §7`

**Code reference**: `.env` (all `*_SERVICE_TOKEN` vars), `src/lib/service-token.ts`

**Problem**: The doc says tokens should be "rotables" (rotatable), but there's no mechanism to rotate them without downtime. No support for multiple valid tokens per pair.

**Recommended fix**: Consider storing hashed tokens in the database so multiple valid tokens can exist simultaneously during rotation.

---

## F-SEC07 — Webhook signature validation may reject valid production webhooks

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `07-integracion-mercadopago.md §Paso 7`

**Code reference**: `src/lib/webhook-signature.ts` (lines 76-112)

**Problem**: The signature validation builds the manifest as:
```
id:{data.id};request-id:{x-request-id};ts:{ts};
```

But Mercado Pago's documented signing format includes `data.id` differently depending on the notification type. For payment notifications:
- Some versions send `data.id` in the body
- Some versions send it as a query parameter

If the `x-request-id` header is not sent by MP (which it often isn't in Webhook test mode), the signature validation will fail because the manifest includes `request-id:;`.

**Recommended fix**: Make `x-request-id` optional in the manifest. Only include it if present.

---

## F-SEC08 — No webhook replay protection beyond timestamp freshness

**Severity**: Low  
**Priority**: P3  
**Documentation**: `07-integracion-mercadopago.md §Paso 7`

**Code reference**: `src/app/webhooks/mercadopago/route.ts`

**Problem**: The `mp_event_id` is generated client-side from the X-Request-Id or current timestamp, not derived from the MP event itself. This means:
1. The same MP event could be processed twice if it comes with different `X-Request-Id` values
2. The deduplication relies on the synthetic key, not the actual MP event ID

**Recommended fix**: Extract the actual MP event ID from the payload and use it as `mp_event_id`. Add a uniqueness constraint on the actual MP event identifier.
