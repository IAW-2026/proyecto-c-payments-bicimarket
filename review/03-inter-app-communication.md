# Inter-App Communication — Audit Findings

---

## Finding IAC-1: Outbound Notifications Never Triggered

**Severity**: Critical | **Priority**: P0

**Documentation**: 
- `docs/01-descripcion.md §4.1` — After webhook: P→B (PATCH orders status), P→S (POST sales-orders)
- `docs/03-apis.md §Notificaciones inter-apps` — End-to-end notification flow

**Code**: 
- `src/webhooks/mercadopago/route.ts:65-91` — `processWebhookEvent` does nothing
- `src/services/inter-app-client.service.ts` — `notifyBuyerOrderStatus` and `createSellerSalesOrder` are defined but never imported/called

**Problem**: The inter-app client service has two critical functions (`notifyBuyerOrderStatus`, `createSellerSalesOrder`) but they are NEVER called from anywhere in the codebase. The webhook event processing, which should trigger these calls, is a no-op.

When a payment is approved via MP webhook:
1. Buyer App is NOT notified (`PATCH /api/v1/orders/{id}/status`)
2. Seller App does NOT get sales orders created (`POST /api/v1/sales-orders`)
3. Settlements are NOT auto-created
4. The entire post-payment workflow is dead

**Root Cause**: The webhook processor was never wired to call the inter-app client functions.

**Solution**: Wire `processWebhookEvent` to:
1. Update payment status locally
2. Call `notifyBuyerOrderStatus` when payment is approved/rejected
3. Call `createSellerSalesOrders` (for each seller) when payment is approved
4. Create settlements for each seller group
5. Log all outbound calls with proper timing

**Risk if ignored**: After a buyer pays, the order remains `pending_payment` forever. No sales orders are created. No fulfillment happens.

---

## Finding IAC-2: Missing User-Agent Header on Outbound Calls

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/03-apis.md §Notificaciones inter-apps` — Headers must include:
```
User-Agent: bicimarket-<app-origen>/1.0
```

**Code**: `src/services/inter-app-client.service.ts:16` — The axios config doesn't include `User-Agent`.

**Problem**: The documented `User-Agent` header is not set on any outbound call. The receiving apps cannot identify which service is calling them.

**Root Cause**: Oversight during implementation.

**Solution**: Add `User-Agent: bicimarket-payments/1.0` to all outbound requests.

**Risk if ignored**: Low security risk, but violates documented contract and reduces operational visibility.

---

## Finding IAC-3: Outbound Calls Use Raw Axios Instead of Configured Instance

**Severity**: Low | **Priority**: P3

**Documentation**: The app's `src/lib/axios.ts` creates a preconfigured Axios instance.

**Code**: `src/services/inter-app-client.service.ts` uses `axios.create()`? No — it imports `axios` directly:
```typescript
import axios from 'axios'
```

**Problem**: The inter-app client creates a new raw Axios call instead of using a configured instance. This means:
- No baseURL configuration
- No default timeout
- No retry configuration at the transport level
- No request/response interceptors

**Root Cause**: The service was built independently without leveraging the existing Axios infrastructure.

**Solution**: Create a dedicated inter-app Axios instance with:
- Base URL configuration per target app via env vars
- 5-second timeout (per doc spec)
- Request/response interceptors for logging
- Proper error handling

**Risk if ignored**: Unlikely to cause bugs but represents code inconsistency.
