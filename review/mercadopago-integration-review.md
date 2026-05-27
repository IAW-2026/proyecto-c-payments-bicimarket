# Mercado Pago Integration Review

## What Was Implemented

### Core Backend (existing, enhanced)
| Component | File | Status |
|---|---|---|
| MP API Client | `src/services/mercado-pago.service.ts` | Enhanced — sandbox mode, structured errors, logging |
| Payment Creation | `src/app/api/v1/payments/route.ts` (POST) | Enhanced — admin JWT auth, idempotency, zod validation |
| Payment Detail | `src/app/api/v1/payments/[paymentId]/route.ts` | Existing |
| Refund | `src/app/api/v1/payments/[paymentId]/refund/route.ts` | Existing |
| Cancel | `src/app/api/v1/payments/[paymentId]/cancel/route.ts` | Existing |
| Admin Confirm | `src/app/api/v1/payments/[paymentId]/confirm/route.ts` | Existing |
| Webhook Handler | `src/webhooks/mercadopago/route.ts` | Existing |
| Signature Validation | `src/lib/webhook-signature.ts` | Existing |
| Inter-app Client | `src/services/inter-app-client.service.ts` | Existing |

### New Additions

| Component | File | Purpose |
|---|---|---|
| Zod Schemas | `src/schemas/payment.ts` | Runtime validation for payment/refund/settlement creation |
| Mock Checkout Page | `src/app/test/checkout/page.tsx` | Testing UI for MP Checkout Pro flow |
| Seed Script | `prisma/seed.ts` | Example payment with settlements and receipt |
| Example Env | `.env.example` | Template for all required env vars |
| Env Validation | `src/lib/env.ts` (updated) | Added `MERCADOPAGO_SANDBOX_MODE` |

### Modified Files

| File | Change |
|---|---|
| `.env` | `MP_ACCESS_TOKEN` → `MERCADOPAGO_ACCESS_TOKEN` (align with docs), added `MERCADOPAGO_SANDBOX_MODE`, `MERCADOPAGO_WEBHOOK_URL` |
| `src/proxy.ts` | Added `/test(.*)` as public route so mock checkout is accessible |
| `src/lib/env.ts` | Added `MERCADOPAGO_SANDBOX_MODE` as optional var |
| `src/types/payments.ts` | Added `buyer_email`, `return_urls` to `PaymentCreateRequest`; added `gateway_reference` to `PaymentResponse` |
| `package.json` | Added `seed` and `seed:reset` scripts, prisma seed config |
| `src/services/mercado-pago.service.ts` | `MercadoPagoError` class, sandbox mode toggle, structured logging, error context |
| `src/app/api/v1/payments/route.ts` | Admin JWT fallback auth, `checkIdempotency`/`cacheIdempotencyResponse` pattern, zod validation |

---

## Architectural Decisions

### 1. Raw Axios over Mercado Pago SDK
The `mercadopago` npm SDK v3 is installed but not used. The existing codebase uses raw axios for MP API calls (established in the original `mercado-pago.service.ts`). Switching to the SDK would change every existing call without functional benefit. The SDK is kept available for future use (e.g., frontend Brick integration).

### 2. Admin JWT as Alternative Auth
The POST `/api/v1/payments` endpoint now accepts either:
- `X-Service-Token` (Buyer App → production)
- Clerk JWT with `publicMetadata.admin === true` (admin UI → testing)

This avoids exposing service tokens to the browser and allows the mock checkout page to work without backend changes. The auth check is: validate service token first; if missing, fall back to Clerk session check.

### 3. Zod for Runtime Validation
Zod schemas in `src/schemas/payment.ts` provide declarative validation matching the API contracts in `docs/03-apis.md`. Using zod rather than manual checks keeps validation consistent and produces structured error responses.

### 4. Sandbox Mode via Env Toggle
`MERCADOPAGO_SANDBOX_MODE=true` switches the `init_point` returned by `createCheckoutPreference` to use MP's sandbox URL. This avoids needing separate sandbox credentials — the same access token works for both modes (MP differentiates by the `init_point` vs `sandbox_init_point` in the preference response).

### 5. Full Idempotency Pattern
The payment creation endpoint now:
1. Checks `findByIdempotencyKey` (payment table lookup)
2. Checks `checkIdempotency` (idempotency keys table)
3. Caches the response via `cacheIdempotencyResponse` after creation

This matches the documented idempotency pattern in `src/lib/idempotency.ts`.

---

## Deviations from Docs

### 1. Env Var Naming (aligned)
The `.env` originally used `MP_ACCESS_TOKEN` (matching the reference doc in `referencias/`). The main docs (`docs/03-apis.md`) specify `MERCADOPAGO_ACCESS_TOKEN`. Since the docs are the source of truth, we aligned to `MERCADOPAGO_` prefix. The service already used this prefix.

### 2. `items_summary` Extends API Contract
The docs specify `items_summary` with `seller_profile_id`, `subtotal_cents`, `shipping_cost_cents`. The implementation extends this with optional fields (`order_seller_group_id`, `buyer_profile_id`, `items`, `shipping_address_snapshot`) required by the webhook handler to create sales orders. This is backwards-compatible — all original fields remain required.

### 3. No Separate Sandbox Credentials
The docs imply separate sandbox/production credentials. The implementation uses a mode toggle instead, which is how MP's Checkout Pro flow works: one set of credentials, different `init_point` URLs.

### 4. Webhook Signature Validation
The docs show `x-request-id` as mandatory in webhook signature validation. The existing implementation supports both with and without `x-request-id` (fallback to body-only HMAC). This is more robust.

---

## Security Considerations

### 1. Service Tokens Never Exposed to Client
The mock checkout page authenticates via Clerk JWT (admin session), not service tokens. No inter-app credentials are sent to the browser.

### 2. Webhook Signature Validation
All incoming MP webhooks are validated with HMAC-SHA256 before processing. Invalid signatures are logged but acknowledged with a 200 response (MP requires 2xx to stop retries).

### 3. Idempotency Prevents Duplicates
Both the `IdempotencyKey` table and the `idempotency_key` unique constraint on `Payment` prevent duplicate payment creation.

### 4. Structured Error Handling
The `MercadoPagoError` class wraps all MP API errors with status code, error code, and message. In production, the `502 UPSTREAM_ERROR` status is returned without exposing MP internals.

### 5. Amount Validation
`items_summary` totals are validated against `amount_cents` to prevent mismatch between the request amount and the per-seller breakdown.

### 6. Admin-only for Test Page
The mock checkout page is registered as a public route via Clerk middleware, but the API endpoint it calls still requires admin auth. This means an unauthenticated visitor can see the page but cannot create payments.

---

## Remaining Risks / Limitations

### 1. No MP SDK Frontend Integration
The `mercadopago` SDK could be used for frontend Brick (card form) integration. Currently only Checkout Pro (redirect) is implemented.

### 2. Pending Settlement Auto-Payout
The settlement → payout flow is not automated. Admin must manually trigger payouts or set up a cron job calling `POST /api/v1/payouts`. The transfer logic in `mercado-pago.service.ts` is ready but not wired.

### 3. Seller MP Account Linking
Transfers require the seller to have a linked Mercado Pago account (`collector_id`). This onboarding flow lives in the Seller App and is out of scope for the Payments App.

### 4. Webhook Idempotency
The webhook handler does not deduplicate by `mp_event_id` before processing. If MP sends the same event twice, the payment will be processed twice (though the second `PATCH` should be idempotent since status is already updated).

### 5. Partial Refund Tracking
The refund endpoint correctly tracks partial refunds but the `payment.status` stays `approved` until fully refunded. The Buyer/Seller App notifications fire on every refund, not just the final one.

### 6. No Rate Limiting
The MP API client has a 10s timeout but no retry logic for transient MP errors (429, 5xx). If MP is rate-limited, the payment creation silently fails (falls back to a payment without `gateway_reference`).

### 7. Test Cards Require Specific Setup
MP sandbox test cards only work in sandbox mode with test users. Production cards require real credentials and approved MP application.

---

## Local Testing Steps

### Prerequisites
- Node.js 20+
- PostgreSQL (or Supabase connection string)
- Mercado Pago sandbox account with credentials

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd proyecto-c-payments-bicimarket
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials:
#   - DATABASE_URL, DIRECT_URL
#   - Clerk keys (or use existing test keys)
#   - MERCADOPAGO_ACCESS_TOKEN (sandbox)
#   - MERCADOPAGO_PUBLIC_KEY (sandbox)
#   - MERCADOPAGO_SANDBOX_MODE=true

# 3. Run migrations and seed
npx prisma migrate dev
npm run seed

# 4. Start dev server
npm run dev
```

### Testing the Mock Checkout

1. Open [http://localhost:3000/test/checkout](http://localhost:3000/test/checkout)
2. Enter buyer email (e.g., `test@test.com`)
3. Enter product title (e.g., `Bicicleta Trek Marlin 5`)
4. Enter amount (e.g., `500.00` for ARS 500)
5. Click **Iniciar Pago**
6. A success alert appears with the checkout URL
7. Click **Abrir Checkout MP** to open Mercado Pago sandbox checkout
8. In the MP sandbox, use test card:
   - **Approved**: `4111 1111 1111 1111` (CVV: 123, Exp: 12/30)
   - **Rejected**: `4000 0000 0000 0002` (CVV: 123, Exp: 12/30)
9. Complete the payment in MP sandbox
10. MP sends webhook to `/webhooks/mercadopago`
11. Check admin dashboard at [http://localhost:3000/admin](http://localhost:3000/admin)

### Testing via API Directly

```bash
# Create payment (needs admin JWT from browser session)
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=<your-clerk-session>" \
  -d '{
    "order_id": "ord_test_001",
    "buyer_profile_id": "byp_test_001",
    "buyer_clerk_user_id": "user_test_001",
    "buyer_email": "test@test.com",
    "amount_cents": 50000,
    "items_summary": [{"seller_profile_id": "slp_test_001", "subtotal_cents": 50000, "shipping_cost_cents": 0}]
  }'
```

### Seed Data

```bash
npm run seed
```

Creates:
- 1 approved payment (`pay_...`) with 2 seller groups
- 2 pending settlements
- 1 receipt

---

## Webhook Testing Flow

### With ngrok (local testing)

```bash
# 1. Start ngrok
ngrok http 3000

# 2. Configure MP webhook
# In Mercado Pago Dashboard > Webhooks:
#   URL: https://<your-ngrok>.ngrok.io/webhooks/mercadopago
#   Events: payment.created, payment.updated

# 3. Set webhook secret in .env
MERCADOPAGO_WEBHOOK_SECRET=your-signing-secret
MERCADOPAGO_WEBHOOK_URL=https://<your-ngrok>.ngrok.io/webhooks/mercadopago
```

### Simulating a webhook locally

```bash
# Generate signature (replace SECRET with your MERCADOPAGO_WEBHOOK_SECRET)
SECRET="your-webhook-secret"
BODY='{"id":12345,"type":"payment.updated","data":{"id":"987654321"},"action":"payment.updated"}'
TIMESTAMP=$(date +%s)
SIGNED_STRING="${TIMESTAMP}.${BODY}"
SIGNATURE=$(echo -n "$SIGNED_STRING" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

# Send webhook
curl -X POST http://localhost:3000/webhooks/mercadopago \
  -H "Content-Type: application/json" \
  -H "x-signature: ts=$TIMESTAMP,v1=$SIGNATURE" \
  -H "x-request-id: test-request-123" \
  -d "$BODY"
```

### What the webhook does

1. Receives POST from MP with `payment.updated` event
2. Validates HMAC-SHA256 signature
3. Logs event in `MpWebhookEvent` table
4. Fetches MP payment detail via `GET /v1/payments/{id}`
5. Finds local payment by `gateway_reference`
6. Updates local payment status:
   - `approved` → notifies Buyer (`PATCH /orders/{id}/status`), creates Seller sales orders
   - `rejected` → notifies Buyer (`PATCH /orders/{id}/status` with `payment_failed`)
   - `refunded` → update to refunded status, notifies Buyer
7. Records status change in `PaymentStatusHistory`

### Verifying webhook processing

```bash
# Check webhook events in DB
curl http://localhost:3000/api/v1/payments?orderId=ord_test_001

# Check MpWebhookEvent logs
psql $DATABASE_URL -c "SELECT id, event_type, signature_valid, status FROM mp_webhook_events ORDER BY created_at DESC LIMIT 5;"
```

---

## Production Deployment Considerations

### Before Deploying

1. **Credentials**
   - Switch `MERCADOPAGO_ACCESS_TOKEN` to production token (starts with `APP_USR-`)
   - Set `MERCADOPAGO_SANDBOX_MODE=false`
   - Set real `MERCADOPAGO_WEBHOOK_SECRET` from production dashboard

2. **Webhook Registration**
   - Register webhook URL in MP production dashboard
   - Events: `payment.created`, `payment.updated`
   - URL: `https://payments.bicimarket.com/webhooks/mercadopago`

3. **Service Tokens**
   - Rotate all `*_SERVICE_TOKEN` values to production secrets
   - Ensure inter-app URLs (`BUYER_APP_URL`, `SELLER_APP_URL`) point to production

4. **Environment Validation**
   - Set `NODE_ENV=production` — this triggers `ensureEnv()` to throw on missing vars

### Post-Deployment

1. **Monitoring**
   - Monitor `MpWebhookEvent` for failed processing (`status = 'failed'`)
   - Monitor `OutboundCallLog` for inter-app communication errors
   - Set up alerts on `502 UPSTREAM_ERROR` responses (MP API failures)

2. **Testing**
   - Run a test payment with a real credit card
   - Verify webhook processing within seconds
   - Check Buyer App receives order status update
   - Verify Seller App receives sales order creation

3. **Seller Onboarding**
   - Ensure sellers link their MP accounts (collector IDs)
   - The `bank_account_reference` field in Seller Profile must store the MP collector ID

4. **Payout Flow**
   - Set up a cron job (or manual admin trigger) to call `POST /api/v1/payouts` for pending settlements
   - Monitor `Payout` records for failed transfers

### Recommended Monitoring Queries

```sql
-- Failed webhooks
SELECT * FROM mp_webhook_events WHERE status = 'failed' AND created_at > now() - interval '24h';

-- Pending webhooks (>5 min)
SELECT * FROM mp_webhook_events WHERE status = 'received' AND created_at < now() - interval '5min';

-- Failed inter-app calls
SELECT * FROM outbound_calls_log WHERE succeeded_at IS NULL AND attempts > 0;

-- Payments without gateway reference (MP creation failed)
SELECT * FROM payments WHERE gateway_reference IS NULL AND status = 'pending' AND created_at > now() - interval '24h';

-- Settlements pending > 7 days
SELECT * FROM settlements WHERE status = 'pending' AND created_at < now() - interval '7 days';
```
