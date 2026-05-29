# Frontend / UI Findings

---

## F-UI01 — `checkout-form.tsx` and `checkout/page.tsx` are near-duplicates

**Severity**: Medium  
**Priority**: P2  

**Code references**:
- `src/components/payments/checkout-form.tsx` (270 lines)
- `src/app/checkout/page.tsx` (117 lines)

**Problem**: Two implementations of the same checkout UI. The standalone `checkout/page.tsx` hardcodes demo items and seller groups, while `checkout-form.tsx` accepts them as props. This is duplication at the implementation level — the page should just use the form component.

**Material difference**: `checkout-form.tsx` uses full client component with state management and MP SDK integration. `checkout/page.tsx` uses a separate `mercadoPagoWidget` approach. They'll diverge over time.

**Recommended fix**: Delete the standalone rendering logic in `checkout/page.tsx` and render `<CheckoutForm />` with the same props.

---

## F-UI02 — No admin dashboard pages implemented

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `05-usuarios.md §3` (admin dashboard)

**Code reference**: `src/app/admin/` — only contains `layout.tsx` (auth check), no page content exists.

**Problem**: The admin layout exists and enforces auth, but there are no actual admin pages:
- No admin dashboard `/admin`
- No payment listing UI
- No refund management interface
- No settlement/payout admin panel

Admins have no way to manage payments without calling the API directly.

**Recommended fix**: Implement:
1. Admin dashboard index with summary cards (total payments, pending refunds, settlements due)
2. Payment listing with search/filter
3. Refund approval flow
4. Settlement review and payout trigger UI

---

## F-UI03 — Checkout page uses `'use client'` at page level instead of component level

**Severity**: Informational  
**Priority**: P3  

**Code reference**: `src/app/checkout/page.tsx` (line 1: `'use client'`)

**Problem**: The entire page is a client component when only the interactive form needs client-side rendering. This prevents server-side rendering of static content (description, layout).

**Recommended fix**: Convert `page.tsx` to a server component and isolate the interactive checkout form in a client component.

---

## F-UI04 — Checkout success/failure/pending pages are skeleton/missing

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `07-integracion-mercadopago.md §Paso 5`

**Code reference**: 
- `src/app/checkout/success/page.tsx` — exists but skeleton
- `src/app/checkout/failure/` — does NOT exist
- `src/app/checkout/pending/` — does NOT exist

**Problem**: The `back_urls` in MP preference point to `/checkout/success`, `/checkout/failure`, and `/checkout/pending`. Only the success page exists (with basic "gracias por tu compra" text). The failure and pending pages are missing, so MP redirects would result in 404s.

**Recommended fix**: Create the missing `failure/page.tsx` and `pending/page.tsx` with appropriate UI and retry guidance.

---

## F-UI05 — `CheckoutForm` loads MP SDK synchronously, blocking render

**Severity**: Low  
**Priority**: P3  
**Code reference**: `src/components/payments/checkout-form.tsx` (line 21: `MercadoPago` import)

**Problem**: The MP SDK is imported at the module level, which means the entire form component's JavaScript bundle includes the MP SDK. This increases initial load time.

**Recommended fix**: Use dynamic import with `next/dynamic` for the checkout form, or load the MP SDK script tag dynamically using `@mercadopago/sdk-react`.

---

## F-UI06 — No loading states in any page

**Severity**: Medium  
**Priority**: P2  

**Code references**:
- `src/app/payments/[paymentId]/page.tsx` — no loading.tsx or Suspense boundary
- `src/app/receipts/[receiptId]/page.tsx` — no loading state
- `src/app/checkout/page.tsx` — no loading state

**Problem**: None of the pages implement loading.tsx files or Suspense boundaries. Users see a blank screen while data is being fetched.

**Recommended fix**: Add `loading.tsx` for each route segment, or wrap data-dependent components in `<Suspense>`.

---

## F-UI07 — Error boundaries are missing

**Severity**: Medium  
**Priority**: P2  

**Code reference**: No `error.tsx` files exist anywhere in `src/app/`.

**Problem**: If any API call fails or component throws, the user sees a blank screen with no error recovery options (retry button, etc.).

**Recommended fix**: Add `error.tsx` boundary files to each route group.

---

## F-UI08 — Hardcoded checkout success message doesn't show payment details

**Severity**: Low  
**Priority**: P3  
**Code reference**: `src/app/checkout/success/page.tsx`

**Problem**: The page shows a generic "Gracias por tu compra" message without showing payment ID, amount, or order details. Users have no way to confirm what they paid for.

**Recommended fix**: Fetch and display payment details from the payment_id query parameter.
