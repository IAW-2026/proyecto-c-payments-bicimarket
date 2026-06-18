# Necessary Backend Endpoints for Analytics Dashboard

All data consumed by the Manager Analytics Dashboard is currently mocked in `src/lib/mock/`. This document lists every endpoint each app must expose for the dashboard to work with real data.

**Conventions:**
- All endpoints prefixed `/api/v1/...` (public business endpoints) or `/api/internal/...` (server-to-server).
- All list endpoints return `PaginatedResponse<T>` (`{ data: T[], pagination: { page, limit, total, totalPages, hasMore } }`).
- All endpoints accept query params `?from=<ISO>&to=<ISO>&page=N&limit=N`.
- Pagination defaults: page=1, limit=20 unless noted.
- Error format: `{ "error": { "code": "...", "message": "...", "details": {} } }`.

---

## Authentication for Analytics Endpoints

All analytics/metrics endpoints under **Payments App** are gated behind a dedicated service token:

| Consumer | Auth mechanism | Routes |
|---|---|---|
| Analytics App | `X-Service-Token: <DASHBOARD_TO_PAYMENTS_SERVICE_TOKEN>` | All `/metrics`, `/revenue/*`, `/commission/*`, `/status-breakdown`, `/pending-by-seller` |
| Admin UI (Clerk JWT) | ❌ Rejected — not allowed | N/A |

**Key rules:**
- These metrics endpoints have **no admin JWT fallback**. Only the Analytics App can call them.
- The Analytics App must set the `DASHBOARD_TO_PAYMENTS_SERVICE_TOKEN` environment variable in the Payments App deployment.
- Existing CRUD endpoints (`GET /api/v1/payments`, `GET /api/v1/settlements`, etc.) continue to accept both JWT and service tokens.

---

## Payments App

### Payments

| # | Endpoint | Hook | Status | Notes |
|---|---|---|---|---|
| 1 | `GET /api/v1/payments?from=&to=&page=&limit=` | `useTopProductsByRevenue` (via `getPaymentsAll`) | ✅ Already existed | Supports `limit=100` max. The dashboard should NOT attempt unpaginated fetch; use `/metrics` for aggregates and `/revenue/*` for breakdowns. |
| 2 | `GET /api/v1/payments/metrics?from=&to=` | `usePaymentMetrics` | ✅ Implemented | Returns `{ total_cents, count, approved_count, avg_order_cents, success_rate }`. Auth: `X-Analytics-Token`. |
| 3 | `GET /api/v1/payments/revenue/timeseries?from=&to=` | `useRevenueTimeSeries` | ✅ Implemented | Daily buckets. Returns `[{ date, value }]` in descending order. Auth: `X-Analytics-Token`. |
| 4 | `GET /api/v1/payments/revenue/by-day-of-week?from=&to=` | `useRevenueByDayOfWeek` | ⏭️ Skipped | Client-side computable from `timeseries` data. Not worth a dedicated endpoint. |
| 5 | `GET /api/v1/payments/revenue/by-method?from=&to=` | `useRevenueByMethod` | ✅ Implemented | Returns `[{ method, value, percentage }]`. Methods: `credit_card, debit_card, mercadopago, transfer, wallet`. Auth: `X-Analytics-Token`. |
| 6 | `GET /api/v1/payments/revenue/by-seller?from=&to=` | `useRevenueBySeller` | ✅ Implemented | Returns `[{ seller_profile_id, revenue_cents }]`. No `seller_name` — Analytics App batch-resolves names via Seller App (`GET /api/v1/sellers/:id`). Auth: `X-Analytics-Token`. |
| 7 | `GET /api/v1/payments/top-products?from=&to=&limit=10` | `useTopProductsByRevenue` | ⏭️ Skipped | Cross-domain (product names live in Seller/Product App), fragile. Client-side computable from paginated payment list. |

### Settlements

| # | Endpoint | Hook | Status | Notes |
|---|---|---|---|---|
| 8 | `GET /api/v1/settlements?from=&to=&status=&page=&limit=` | `useRecentSettlements` | ✅ Already existed | Status filter optional. Recent uses `limit=5`. |
| 9 | `GET /api/v1/settlements/metrics?from=&to=` | `useSettlementMetrics` | ✅ Implemented | Returns `{ total_cents, fee_cents, net_cents, total_count, pending_count, paid_count, failed_count, manual_review_count, avg_velocity_days }`. Auth: `X-Analytics-Token`. |
| 10 | `GET /api/v1/settlements/commission/timeseries?from=&to=` | `useCommissionTimeSeries` | ✅ Implemented | Monthly fee buckets. Returns `[{ date, value }]`. Auth: `X-Analytics-Token`. |
| 11 | `GET /api/v1/settlements/status-breakdown?from=&to=` | `useSettlementStatusBreakdown` | ✅ Implemented | Returns `[{ status, count }]`. Statuses: `pending, paid, failed, manual_review`. Auth: `X-Analytics-Token`. |
| 12 | `GET /api/v1/settlements/pending-by-seller?from=&to=` | `usePendingSettlementsBySeller` | ✅ Implemented | Returns `[{ seller_profile_id, pending_count, total_cents }]`. No `seller_name` — resolve via Seller App. Auth: `X-Analytics-Token`. |

### Refunds

| # | Endpoint | Hook | Status | Notes |
|---|---|---|---|---|
| 13 | `GET /api/v1/refunds?from=&to=&page=&limit=` | (internal) | ✅ Already existed | Admin-only (JWT). |
| 14 | `GET /api/v1/refunds/metrics?from=&to=` | `useRefundMetrics` | ✅ Implemented | Returns `{ total, approved_count, total_amount_cents, by_reason: [{ reason, count }] }`. Reasons: `seller_rejected, buyer_cancelled, not_delivered, manual`. `by_reason` only includes reasons with approved refunds. Auth: `X-Analytics-Token`. |

### Payouts

| # | Endpoint | Hook | Status | Notes |
|---|---|---|---|---|
| 15 | `GET /api/v1/payouts?from=&to=&page=&limit=` | `useRecentPayouts` | ✅ Already existed | Recent uses `limit=5`. |
| 16 | `GET /api/v1/payouts/metrics?from=&to=` | `usePayoutMetrics` | ✅ Implemented | Returns `{ count, completed_count, failed_count, in_progress_count, pending_count, manual_review_count }`. No `total_cents` (payouts don't carry amount — amounts live on Settlement). Auth: `X-Analytics-Token`. |

---

## Seller Name Resolution Flow

Metrics that group by seller (`revenue/by-seller`, `settlements/pending-by-seller`) return `seller_profile_id` **only** — the Payments App does not store seller names.

The Analytics App must:
1. Collect all unique `seller_profile_id` values from the response.
2. Call `GET /api/v1/sellers/:id` on Seller App for each (or batch if available).
3. Map `seller_profile_id` → `seller_name` in the dashboard UI.

**Auth**: Use the Analytics App's `ANALYTICS_TO_SELLER_SERVICE_TOKEN` when calling Seller App endpoints.

---

## Seller App

### Products

| Endpoint | Hook | Notes |
|---|---|---|
| `GET /api/v1/products?page=&limit=` | (used internally) | Products are mostly static; no date filter used. Limit defaults to 50. |
| `GET /api/v1/products/metrics` | `useProductMetrics` | No date filter. Returns `{ total, categories_count, avg_price_cents, by_category: [{ category, count }], by_condition: [{ condition, count }] }`. Categories: `mtb, road, urban, kids, bmx, parts, accessories, indumentaria`. Conditions: `new, used_like_new, used_good, used_fair`. |

### Sales Orders

| Endpoint | Hook | Notes |
|---|---|---|
| `GET /api/v1/sales-orders?from=&to=&fulfillment_status=&page=&limit=` | (internal) | Status filter optional. |
| `GET /api/v1/sales-orders/metrics?from=&to=` | `useSalesOrderMetrics` | Returns `{ total, pending_count, accepted_count, delivered_count, acceptance_rate, pending_by_seller: [{ seller_profile_id, seller_name, count, oldest_date }] }`. |

### Sellers

| Endpoint | Hook | Notes |
|---|---|---|
| `GET /api/v1/sellers` | (internal) | All seller profiles. Used for settlement table and seller detail sheet. |
| `GET /api/v1/sellers/metrics` | `useSellerMetrics` | No date filter. Returns `{ total, verified_count, pending_count, suspended_count, product_count_total }`. |
| `GET /api/v1/sellers/:id` | (Seller detail) | Individual seller profile with settlements. |

---

## Shipping App

### Shipments

| Endpoint | Hook | Notes |
|---|---|---|
| `GET /api/v1/shipments?from=&to=&status=&page=&limit=` | (internal) | Status filter optional. |
| `GET /api/v1/shipments/metrics?from=&to=` | `useShipmentMetrics` | Returns `{ total, delivered_count, in_transit_count, failed_count, fulfillment_rate, avg_delivery_time_days, backlog_by_status: [{ status, count }] }`. Statuses: `created, ready_for_pickup, picked_up, in_transit, out_for_delivery, delivered, failed_delivery, returned`. |

---

## Buyer App (Future)

### Buyers

| Endpoint | Hook | Notes |
|---|---|---|
| `GET /api/v1/admin/buyers` | None yet | Required for Customer Analytics page. Page currently shows "requires Buyer App endpoint" banners. |
| `GET /api/v1/admin/buyers/metrics` | None yet | Would return `{ total, new_this_period, repeat_rate, at_risk_count }`. |

---

## Endpoint Inventory by App

| App | Endpoints Needed | Status |
|---|---|---|
| **Payments** | 16 (`/payments*`, `/payments/metrics`, `/payments/revenue/*` (5), `/settlements*`, `/refunds/metrics`, `/payouts*`) | ✅ 12 implemented (incl. existing CRUD), 2 skipped, 2 existing CRUD for refunds & payouts |
| **Seller** | 5 (`/products*`, `/sales-orders*`, `/sellers*`) | Required for Products, Sellers, Operations pages |
| **Shipping** | 2 (`/shipments*`) | Required for Operations page |
| **Buyer** | 2 (`/admin/buyers*`) | Required for Customer Analytics (not yet implemented) |

**Total endpoints:** ~23 REST endpoints across 4 apps.
