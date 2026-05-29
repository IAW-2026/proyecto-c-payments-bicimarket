# Data Model & Schema Findings

---

## F-DM01 — ID generation uses truncated UUID instead of CUID/ULID

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `04-modelo-de-datos.md §0` (IDs: `String @id @default(cuid())` with prefix)

**Code reference**: `src/lib/id-generator.ts`

**What exists**: 
```typescript
function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}
```

**What docs require**: CUID/ULID with resource prefix.

**Problem**: The implementation uses a truncated UUID (20 hex chars) which has:
- Higher collision probability than full UUID or CUID
- No temporal ordering (CUIDs are sortable by creation time)
- The slice(0,20) is a magic number with no documented rationale

**Recommended fix**: Use `cuid2` or a proper ULID library. Keep the prefix system but generate the random portion with a proper collision-resistant algorithm.

---

## F-DM02 — Missing `AdminProfile` model

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `05-usuarios.md §3.2`, `04-modelo-de-datos.md §4` (Payments App tables)

**Code reference**: `prisma/schema.prisma` — no admin profile model exists.

**Problem**: Docs say Payments App creates `admin_profile` when admin logs in. No such model in schema.

**Recommended fix**: Add:
```prisma
model AdminProfile {
  id             String   @id @default(cuid())
  clerk_user_id  String   @unique
  email          String
  full_name      String?
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
}
```

---

## F-DM03 — `HttpMethod` enum missing `GET`

**Severity**: Low  
**Priority**: P3  
**Documentation**: `prisma/schema.prisma` (lines 74-80)

**Code reference**: `prisma/schema.prisma`, `src/services/inter-app-client.service.ts` (line 42)

**Problem**: The `HttpMethod` Prisma enum includes `POST`, `PUT`, `PATCH`, `DELETE` but NOT `GET`. The `inter-app-client.service.ts` casts the method string to `HttpMethod` when logging outbound calls. If a GET call is logged (e.g., `GET /api/v1/orders/{id}`), the cast will fail.

**Recommended fix**: Add `GET` to the `HttpMethod` Prisma enum and run a migration.

---

## F-DM04 — `items_summary` stored as Json but never validated on retrieval

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `03-apis.md §P1` (items_summary structure)

**Code reference**: `prisma/schema.prisma` (Payment model, line 95: `items_summary Json?`)

**Problem**: The `items_summary` field is stored as unstructured JSON. While it's validated on input (`createPaymentSchema`), it's never validated on retrieval. Over time, malformed data could crash services that parse it (e.g., `shipment-delivered/route.ts` line 96, which accesses fields without type safety).

**Recommended fix**: Use a Zod schema to parse `items_summary` on retrieval. Create a type-safe accessor:
```typescript
export function parseItemsSummary(data: unknown): ItemsSummaryItem[] {
  const result = itemsSummarySchema.array().safeParse(data)
  return result.success ? result.data : []
}
```

---

## F-DM05 — `deleted_at` on Payment is not handled in most queries

**Severity**: Low  
**Priority**: P3  
**Documentation**: `04-modelo-de-datos.md §0` (soft deletes)

**Code references**:
- `src/app/api/v1/payments/route.ts` — no `deleted_at` filter
- `src/app/api/v1/payments/[paymentId]/route.ts` — no `deleted_at` check
- `src/app/api/v1/receipts/route.ts` — no `deleted_at` filter (but Receipt has `deleted_at`)

**Problem**: The Payment model has `deleted_at` but no query filters it out. Deleted payments would still appear in listings and detail views. Similarly, Receipt has `deleted_at` but listing doesn't filter it.

**Recommended fix**: Add `where: { deleted_at: null }` to all payment, receipt, settlement, refund, and payout queries.

---

## F-DM06 — `idempotency_key` on Payment is not truly unique enforced

**Severity**: Medium  
**Priority**: P2  
**Documentation**: `prisma/schema.prisma` (line 94: `idempotency_key String? @unique`)

**Code reference**: `src/app/api/v1/payments/route.ts` (line 117: passes `idempotency_key` from validated data)

**Problem**: The `idempotency_key` field is `String?` (optional) with `@unique`. If `undefined` is sent, Prisma would not enforce the unique constraint. But different `null` values could bypass the check. The route uses `idempotencyKey` from the header, not from the validated body, creating a disconnect.

**Recommended fix**: Always set `idempotency_key` from the header, not from the body. The schema `@unique` will correctly handle `null`.

---

## F-DM07 — `gateway_reference` can store MP preference ID or payment ID ambiguously

**Severity**: Informational  
**Priority**: P3  
**Documentation**: `prisma/schema.prisma` (Payment.gateway_reference)

**Code reference**: `src/services/mercado-pago.service.ts` (creates preference, gets back `init_point` and `body.id`)

**Problem**: `gateway_reference` is used to store both:
1. MP preference ID (when creating a preference)
2. MP payment ID (when webhook arrives, `prisma.payment.update({ gateway_reference: mpDetails.id })`)

The `refund` code uses `payment.gateway_reference` to call MP refund API — but if it stores the preference ID, the refund will fail.

**Recommended fix**: Add separate fields:
- `mp_preference_id` for the checkout preference
- `mp_payment_id` for the actual payment after approval
- Or ensure `gateway_reference` is always updated to the payment ID when webhook arrives
