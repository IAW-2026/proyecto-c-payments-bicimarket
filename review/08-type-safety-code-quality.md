# Type Safety & Code Quality — Audit Findings

---

## Finding TS-1: Pervasive Use of `any` Type

**Severity**: High | **Priority**: P1

**Documentation**: TypeScript strict mode is enabled (`"strict": true` in tsconfig.json).

**Code**: Found in multiple files:
- `src/app/api/v1/payments/route.ts:19` — `const where: any = {}`
- `src/app/api/v1/settlements/route.ts:19` — `const where: any = {}`
- `src/app/api/v1/payouts/route.ts:13` — `const where: any = {}`
- `src/app/api/v1/refunds/route.ts:17` — `const where: any = {}`
- `src/app/api/v1/receipts/route.ts:13` — `const where: any = {}`
- `src/services/mercado-pago.service.ts:5` — `data: any`
- `src/webhooks/mercadopago/route.ts:8` — `payload: any`
- `src/services/inter-app-client.service.ts:34` — `config: any`
- `src/hooks/use-payments.ts:31` — `data: any` in PaymentsTable

**Problem**: The Prisma `where` clause builder pattern forces all dynamic filters to be typed as `any`, which defeats TypeScript's ability to catch invalid field names or value types. This is a systemic issue across all API list routes.

**Root Cause**: No type-safe query builder pattern was established. The team defaulted to `any` for convenience.

**Solution**: 
1. Create typed filter interfaces that map to Prisma's `WhereInput` types
2. Use Prisma's generated types for `where` clauses (e.g., `Prisma.PaymentWhereInput`)
3. Avoid building dynamic where objects — use a functional approach with type narrowing
4. Set ESLint rule `@typescript-eslint/no-explicit-any` to error

**Risk if ignored**: Runtime errors from invalid field names in queries. Loss of IDE autocompletion.

---

## Finding TS-2: Unsafe Type Casts with `as any`

**Severity**: Medium | **Priority**: P2

**Code**: Found in:
- `src/app/api/v1/payments/[paymentId]/confirm/route.ts:40` — `status: newStatus as any`
- `src/app/api/v1/payments/[paymentId]/confirm/route.ts:53` — `from_status: payment.status as any`
- `src/app/api/v1/payments/[paymentId]/cancel/route.ts:55` — `to_status: 'cancelled' as any`
- `src/app/api/v1/internal/shipment-delivered/route.ts:69` — `from_status: existingSettlement.status as any`

**Problem**: Casting to `as any` bypasses TypeScript's type checking for Prisma enum fields. This means invalid status values could be written to the database if the enum definition changes without updating all the cast locations.

**Root Cause**: Mismatch between TypeScript string types and Prisma enum types. The code uses string literals that don't directly map to Prisma-generated enum types.

**Solution**: 
1. Use the proper Prisma-generated enum types instead of string literals
2. Create helper functions for status transitions that return properly typed values
3. Remove all `as any` casts for enum values

**Risk if ignored**: TypeScript won't catch if a status value doesn't exist in the Prisma enum after schema changes.

---

## Finding TS-3: Unused Imports

**Severity**: Low | **Priority**: P3

**Code**: Unused `Prisma` imports:
- `src/app/api/v1/payments/[paymentId]/confirm/route.ts:3` — `import { Prisma } from '@/generated/prisma'`
- `src/app/api/v1/payments/[paymentId]/cancel/route.ts:3` — `import { Prisma } from '@/generated/prisma'`

Unused `crypto` import:
- `src/lib/service-token.ts:1` — `import crypto from 'crypto'` (never used)

**Problem**: These imports are dead code that add noise and slightly increase bundle size.

**Root Cause**: Leftover from earlier implementations or copy-paste.

**Solution**: Remove unused imports.

**Risk if ignored**: Minimal — code cleanliness issue.

---

## Finding TS-4: Inconsistent ARS Formatting in Components

**Severity**: Low | **Priority**: P3

**Code**: `src/components/admin/SettlementTable.tsx:53-55`:
```typescript
<TableCell>${(settlement.gross_amount_cents / 100).toFixed(2)}</TableCell>
```

**Problem**: The SettlementTable component formats currency manually (`$(amount/100).toFixed(2)`) instead of using the shared `ARS()` utility in `src/lib/currency.ts`. This means:
1. Inconsistent formatting with the rest of the app
2. Missing currency symbol prefix (`ARS`)
3. No locale-aware number formatting

**Root Cause**: Component was built independently without using shared utilities.

**Solution**: Replace manual formatting with `ARS()` utility.

**Risk if ignored**: Minor visual inconsistency in the rarely-used component.

---

## Finding TS-5: Missing Error Boundaries

**Severity**: Medium | **Priority**: P2

**Code**: `src/app/error.tsx` — Basic error boundary exists but:
- No logging integration
- No fallback UI for different error types
- No retry mechanism based on error type

**Problem**: The error page shows `error.message` directly to the user, which may expose internal details. There's no structured error handling.

**Root Cause**: Minimal error boundary implementation.

**Solution**: 
1. Add error logging to the error boundary
2. Categorize errors (network, auth, validation, server)
3. Provide contextual recovery actions
4. Never display raw error messages to users

**Risk if ignored**: Users may see confusing or sensitive error messages.
