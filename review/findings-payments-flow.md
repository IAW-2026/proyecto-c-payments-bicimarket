# Payment Lifecycle & Flow Findings

---

## F-PF01 — End-to-end payment flow is broken at the webhook notification stage

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `01-descripcion.md §4.1`, `07-integracion-mercadopago.md §§Paso 5-8`

**The documented flow**:
```
1. POST /api/v1/payments → creates PagoLocal (pending), creates MP Preference
2. Buyer completes checkout on MP → MP sends POST /webhooks/mercadopago
3. Webhook → validates signature → updates PagoLocal to approved
4. Creates Receipt
5. Notifies Buyer App: PATCH buyers/orders/{id}/status → requires_payment → confirmed
6. Notifies Seller App: POST /sales-orders with payment details
7. Admin confirms payment → triggers settlement
8. Settlement → payout → transfer MP funds → settlement paid
```

**The actual implementation**:
```
1. ✅ POST /api/v1/payments → creates Payment (pending), creates MP Preference
2. ✅ Buyer completes checkout → MP sends webhook
3. ✅ Webhook validates signature → updates Payment to approved
4. ✅ Creates Receipt
5. ❌ Does NOT notify Buyer App
6. ❌ Does NOT create Sales Order in Seller App
7. ✅ Admin confirm endpoint exists
8. ❌ Settlement is created but NO payout/transfer executed
```

**Broken pieces**: Steps 5, 6, and 8 are completely missing. The flow stalls at step 4 — the local system knows the payment is approved, but no other system knows.

---

## F-PF02 — Settlement created but never paid

**Severity**: Critical  
**Priority**: P0  
**Documentation**: `01-descripcion.md §4.4`

**Code references**:
- `src/services/settlement.service.ts` — calculates amounts, creates settlement records but never executes transfer
- `src/app/api/v1/settlements/mark_paid/route.ts` — manually marks settlement as paid with no actual MP transfer
- `src/services/mercado-pago.service.ts` — has `createPayment()` for Checkout Pro but NO transfer method

**Problem**: The entire payout flow is a no-op:
1. Settlement is created in `pending` status
2. `mark_paid` route transitions to `paid` with NO actual money movement
3. The MP SDK (`mercadopago`) supports `payment.create()` (Checkout Pro) but NOT `mercadopago.payout` or `mercadopago.transfer`

**Impact**: Sellers never receive funds. The platform processes payments but can't disburse.

**Recommended fix**:
1. Check if the MP account has access to `mercadopago.advancedpayments` (Marketplace mode) or `mercadopago.partners`
2. If using MP's standard checkout (Checkout Pro), the funds stay in the platform's MP account
3. Create a transfer method: `POST /v1/advanced_payments/{id}/disbursements` or `POST /v1/money_requests`
4. Consider implementing MP's Marketplace mode (`marketplace: true` in preference) which allows automatic disbursement
5. See F-T01 (testing) for the test strategy

---

## F-PF03 — Preference creation hardcodes `back_urls` to `localhost:3000`

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/services/mercado-pago.service.ts` (lines 27-29)

```typescript
back_urls: {
  success: `${NEXT_PUBLIC_APP_URL}/checkout/success?payment_id=${payment.id}`,
  failure: `${NEXT_PUBLIC_APP_URL}/checkout/failure?payment_id=${payment.id}`,
  pending: `${NEXT_PUBLIC_APP_URL}/checkout/pending?payment_id=${payment.id}`,
}
```

**Problem**: `NEXT_PUBLIC_APP_URL` in `.env` is set to `http://localhost:3000` (local) while the inter-app client URLs point to Vercel deployments. In production, MP redirects the buyer back to localhost:3000, which won't work.

**Recommended fix**: Ensure `NEXT_PUBLIC_APP_URL` is set correctly per environment. Add environment-specific config validation.

---

## F-PF04 — No `payment_id` validation in preference `back_urls` could allow tampering

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/services/mercado-pago.service.ts` (line 28)

**Problem**: The `back_urls.success` URL includes `payment_id` as a query parameter. If a buyer modifies this URL before returning, they could be redirected to a different payment's success page. There's no validation that the `payment_id` matches the current buyer/session.

**Recommended fix**: Add a signed token or nonce in the `back_urls` that validates the `payment_id` belongs to the current session.

---

## F-PF05 — `shipment-delivered` creates duplicate settlements

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/app/api/v1/internal/shipment-delivered/route.ts`

**Problem**: The route creates `PaymentSettlement` records with no deduplication. If Shipping sends the same delivery notification twice (e.g., due to retry), duplicate settlements are created:
```typescript
const settlement = await prisma.paymentSettlement.create({ ... })
```

There's no `upsert` or pre-check for existing settlement for the same `(payment_id, seller_profile_id)`.

**Recommended fix**: Check for existing settlement before creating:
```typescript
const existing = await prisma.paymentSettlement.findFirst({
  where: { payment_id, seller_profile_id }
})
if (existing) { /* update or skip */ }
else { /* create */ }
```

---

## F-PF06 — Admin confirm endpoint creates duplicate receipts

**Severity**: Medium  
**Priority**: P2  
**Code reference**: `src/app/api/v1/payments/[paymentId]/confirm/route.ts` (line 68)

**Problem**: Similar to above — the admin confirm endpoint creates a receipt without checking if one already exists for the payment. If admin clicks confirm twice, two receipts are created.

**Recommended fix**: Use `upsert` on receipt with payment_id as unique identifier.

---

## F-PF07 — Receipt generation is a skeleton with placeholder HTML

**Severity**: Low  
**Priority**: P3  
**Code reference**: `src/services/receipt-generator.ts`

**Problem**: The receipt generator creates an HTML string with placeholder content. The doc references PDF receipt generation but the implementation uses a basic HTML template with hardcoded values.

**Recommended fix**: Either implement proper PDF generation (e.g., using `pdfkit` or `puppeteer`) or implement the full HTML template with actual receipt data.

---

## F-PF08 — No order status reconciliation endpoint

**Severity**: Low  
**Priority**: P3  
**Documentation**: Not explicitly documented but implied by the async architecture

**Problem**: There's no endpoint for Buyer App to reconcile the status of an order's payments. If the webhook notification fails (e.g., network error), Buyer App has no way to query: "What's the status of the payment for order X?"

**Recommended fix**: Add `GET /api/v1/internal/orders/{orderId}/payment-status` for inter-app reconciliation.

---

## F-PF09 — `GET /api/v1/payments` listing status filter only supports `status` as single value, not array

**Severity**: Informational  
**Priority**: P3  
**Code reference**: `src/app/api/v1/payments/route.ts` (line 13)

**Problem**: The query filter only supports a single status value:
```typescript
where.status = status as PaymentStatus
```

This makes it hard to query multiple statuses (e.g., both `pending` and `approved`).

**Recommended fix**: Support array filter: `status=pending,approved`
