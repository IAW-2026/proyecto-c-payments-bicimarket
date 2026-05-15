# Architectural & Design Issues — Audit Findings

---

## Finding ARCH-1: No Service Layer — Controllers Do Too Much

**Severity**: High | **Priority**: P1

**Documentation**: `docs/02-responsabilidades.md §6` describes Payments App responsibilities.

**Code**: The API routes (`src/app/api/v1/payments/route.ts`, etc.) mix:
1. Request parsing/validation (controller concern)
2. Business logic (service concern)
3. Database operations (repository concern)
4. Error handling (middleware concern)
5. Inter-app communication (client concern)

**Problem**: Route handlers are 60-140 lines of procedural code that mix all concerns. This leads to:
- Duplicated validation logic across routes
- Impossible to test business logic without HTTP
- No clear separation of concerns
- Hard to enforce cross-cutting concerns (logging, auth, metrics)

Example: `POST /api/v1/payments` does payload validation, idempotency check, DB insert, AND should do MP integration — all in one function.

**Root Cause**: Next.js route handler pattern encourages inline code, and no service layer architecture was enforced.

**Solution**: Refactor into clean layers:
```
src/
  routes/       — Request parsing, response formatting, auth
  services/    — Business logic (createPayment, processRefund, etc.)
  repositories/ — Prisma queries (typed, testable)
  clients/    — External API clients (MP, inter-app)
  middleware/  — Auth, logging, error handling
```

**Risk if ignored**: Growing complexity will make the codebase unmaintainable.

---

## Finding ARCH-2: Tight Coupling to Prisma Types

**Severity**: Medium | **Priority**: P2

**Code**: Every route directly imports and uses Prisma types:
```typescript
import { Prisma } from '@/generated/prisma'
```

**Problem**: The entire codebase is tightly coupled to the Prisma ORM. If Prisma is ever replaced or the schema generation changes, every file needs updating. Domain types in `src/types/payments.ts` are not used consistently — routes return raw Prisma objects directly.

**Root Cause**: No domain model abstraction between API responses and database models.

**Solution**: 
1. Define domain models separate from Prisma models
2. Create mappers from DB to API responses
3. Only expose domain models in API responses (never raw Prisma objects)

**Risk if ignored**: Database schema changes can break API contracts unexpectedly.

---

## Finding ARCH-3: No Error Handling Middleware

**Severity**: Medium | **Priority**: P2

**Code**: Every route has try/catch + console.error + generic 500:
```typescript
try {
  // ...
} catch (err) {
  console.error('Error listing payments:', err)
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list payments' } }, { status: 500 })
}
```

**Problem**: Error handling is duplicated in every route. There's no centralized error handler, no error logging service integration, no error categorization, and no consistent user-facing error messages.

**Root Cause**: Next.js Route Handlers don't have a built-in error middleware pattern, so errors are handled per-route.

**Solution**: Create an `errorHandler` wrapper that can be applied to any route handler:
```typescript
export function withErrorHandler(handler: RouteHandler) {
  return async (req: Request, ctx: Context) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      if (err instanceof AppError) { return err.toResponse() }
      console.error(err)
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 })
    }
  }
}
```

**Risk if ignored**: Verbose code, inconsistent error messages, potential information leakage.

---

## Finding ARCH-4: Missing Observability Infrastructure

**Severity**: High | **Priority**: P1

**Documentation**: `docs/02-responsabilidades.md §2.8` — "Logs y trazabilidad: cada request inter-app lleva X-Request-Id"

**Code**: 
- No structured logging (only `console.error` and `console.log`)
- No request ID generation or propagation
- No performance monitoring
- No metrics collection
- `outboundCallLog` table exists but is populated inconsistently

**Problem**: The system has no observability. When a payment flow fails, there is no way to:
1. Trace which request failed and why
2. Measure how long MP API calls take
3. Monitor settlement volumes and failure rates
4. Debug a buyer's complaint about a missing payment

**Root Cause**: Observability was not prioritized beyond the `outboundCallLog` table.

**Solution**: Implement the "Three Pillars of Observability":
1. **Logging**: Replace `console.log/error` with structured logging (e.g., pino) including request IDs
2. **Metrics**: Track payment volumes, refund rates, settlement times via counters/histograms
3. **Tracing**: Propagate `X-Request-Id` across all inter-app calls and log it everywhere

**Risk if ignored**: Production incidents will be extremely difficult to diagnose.

---

## Finding ARCH-5: Missing Rate Limiting

**Severity**: Medium | **Priority**: P2

**Documentation**: `docs/03-apis.md §0.3` — Lists HTTP 429 `RATE_LIMITED` in the error table.

**Code**: No rate limiting middleware exists.

**Problem**: The API specification documents rate limiting (429 response), but the implementation doesn't enforce any rate limits. An attacker or misbehaving client could flood the Payment endpoints.

**Root Cause**: Rate limiting was documented as a requirement but never implemented.

**Solution**: Add rate limiting to API routes using a library like `@upstash/ratelimit` or a simple in-memory token bucket for development.

**Risk if ignored**: Vulnerable to DoS attacks on payment endpoints.

---

## Finding ARCH-6: Missing Request Validation Zod/Validation Layer

**Severity**: High | **Priority**: P1

**Code**: Request body validation is done manually in each route:
```typescript
if (!body?.order_id || !body?.amount_cents || !body?.buyer_profile_id) { ... }
```

**Problem**: Validation is:
1. Manual and error-prone
2. Inconsistent across routes
3. No type inference from validation schemas
4. Missing field-level error messages
5. No schema reuse between API docs and implementation

The OpenAPI spec (`public/docs/openapi.yaml`) already defines the request schemas, but the code doesn't use them.

**Root Cause**: No validation library was integrated for request parsing.

**Solution**: 
1. Add Zod schema validation for every request body
2. Derive TypeScript types from Zod schemas
3. Create a shared validation utility that returns standardized errors
4. Consider generating validation schemas from the OpenAPI spec

**Risk if ignored**: Type mismatches between request expectations and actual data will cause runtime errors instead of clear validation failures.
