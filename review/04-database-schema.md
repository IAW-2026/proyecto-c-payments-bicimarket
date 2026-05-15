# Database Schema & Prisma — Audit Findings

---

## Finding DB-1: IDs Missing Resource Prefixes

**Severity**: High | **Priority**: P1

**Documentation**: `docs/04-modelo-de-datos.md §0.3` — "IDs: `String @id @default(cuid())` con prefijo de recurso (`ord_`, `prd_`, etc.) generado en aplicación"

**Code**: `prisma/schema.prisma` — All models:
```prisma
model Payment {
  id  String  @id @default(cuid())   // Should be pay_...
}
```

**Problem**: All IDs use plain `cuid()` without the required resource prefix (e.g., `pay_01H...`, `set_01H...`, `ref_01H...`). The documentation specifically requires Stripe-style prefixed IDs for all resources.

**Root Cause**: The ID generation was set up with default Prisma cuid() without implementing application-level prefixing.

**Solution**: 
1. Create a custom ID generator function that prefixes each ID type
2. Use Prisma middleware or `@@id` with a custom `before` lifecycle to generate prefixed IDs
3. Example: `pay_${cuid()}` for payments, `set_${cuid()}` for settlements

**Risk if ignored**: ID format inconsistency across the app ecosystem breaks cross-referencing and makes debugging harder.

---

## Finding DB-2: Missing Fields on Payment Model

**Severity**: High | **Priority**: P1

**Documentation**: `docs/04-modelo-de-datos.md §4.1` — Payment model requires:
- `method` (enum: credit_card, debit_card, account_money, pix, bank_transfer)
- `card_last4` (string?)

**Code**: `prisma/schema.prisma:38-62` — Payment model doesn't have `method` or `card_last4` fields.

**Problem**: The payment method and last 4 digits of the card are not stored, despite being specified in the data model and returned in the API response (`docs/03-apis.md §P1`):
```json
{
  "method": "credit_card",
  "card_last4": "1111"
}
```

**Root Cause**: Schema was defined before the fields were documented and never updated.

**Solution**: Add `method` (PaymentMethod enum) and `card_last4` (String?) fields to the Payment model.

**Risk if ignored**: Admin UI cannot display payment method details to operators handling disputes.

---

## Finding DB-3: Missing Soft Delete Fields

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/04-modelo-de-datos.md §0.4` — "Soft deletes: `deleted_at DateTime?` en entidades con historial relevante (productos, perfiles)"

**Code**: The following models are missing `deleted_at`:
- `Payment` — Has `deleted_at` ✓
- `Settlement` — Has `deleted_at` ✓ (but it's wrong — settlements should NOT be soft-deleted, they are financial records)
- `Refund` — Has `deleted_at` ✓
- `Receipt` — Has `deleted_at` ✓
- `Payout` — Missing `deleted_at`

**Problem**: Payout cannot be soft-deleted, which is inconsistent.

**Root Cause**: Inconsistent application of the soft-delete pattern.

**Solution**: Add `deleted_at` to Payout model, or document why it's excluded.

**Risk if ignored**: Minor inconsistency.

---

## Finding DB-4: PaymentAttempt Missing Fields

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/04-modelo-de-datos.md §4.1` — Payment attempts must have:
- `request_payload` (json?)
- `response_payload` (json?)

**Code**: `prisma/schema.prisma:77-89` — PaymentAttempt:
```prisma
model PaymentAttempt {
  id             String   @id @default(cuid())
  status         String   // Should be enum
}
```

Missing: `request_payload`, `response_payload`. Also, `status` is `String` instead of an enum.

**Root Cause**: Schema was simplified during implementation.

**Solution**: Add `request_payload` and `response_payload` fields, and create a proper enum for attempt status.

**Risk if ignored**: Cannot debug failed payment attempts without request/response payload data.

---

## Finding DB-5: Missing Enums for String Fields

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/04-modelo-de-datos.md` specifies enums for most status fields.

**Code**: Multiple models use `String` instead of enums:
- `PaymentAttempt.status` should be an enum (pending, approved, rejected, cancelled)
- `Payout.status` should be an enum
- `MpWebhookEvent.status` should be an enum
- `OutboundCallLog.method` should be restricted to HTTP methods

**Problem**: Using plain strings for status fields loses type safety and allows invalid states to be stored.

**Root Cause**: Incomplete Prisma schema design.

**Solution**: Create proper Prisma enums for all status fields.

**Risk if ignored**: Invalid data can enter the database, causing bugs in filtering and display.

---

## Finding DB-6: Refund Missing Currency Field

**Severity**: Low | **Priority**: P3

**Documentation**: `docs/04-modelo-de-datos.md §4.1` — Refund should have a `currency` field.

**Code**: `prisma/schema.prisma:156-172` — Refund model doesn't have `currency`.

**Problem**: Refunds can't specify a different currency, which is needed for multi-currency support.

**Root Cause**: Oversight.

**Solution**: Add `currency` field with default "ARS".

**Risk if ignored**: Cannot handle multi-currency refunds.
