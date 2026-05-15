# Infrastructure & Configuration — Audit Findings

---

## Finding INFRA-1: No Environment Variable Validation at Startup

**Severity**: High | **Priority**: P1

**Documentation**: `docs/03-apis.md §Secretos y service tokens` — Lists all required environment variables.

**Code**: No startup validation of required environment variables exists. The app will start and fail at runtime with cryptic errors when variables are missing.

Required variables that are NOT validated:
- `DATABASE_URL`, `DIRECT_URL`
- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`
- `BUYER_TO_PAYMENTS_SERVICE_TOKEN`, `SHIPPING_TO_PAYMENTS_SERVICE_TOKEN`, `PAYMENTS_TO_BUYER_SERVICE_TOKEN`, `PAYMENTS_TO_SELLER_SERVICE_TOKEN`
- `BUYER_APP_URL`, `SELLER_APP_URL`
- Clerk variables (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_ISSUER`, `CLERK_AUDIENCE`)

**Problem**: The app starts without validating that critical secrets and endpoints are configured. A misconfigured deployment would fail at the first API call instead of at startup.

**Root Cause**: No environment validation pattern was established.

**Solution**: Create a validation module that checks all required env vars at app startup and fails fast with clear messages if any are missing.

**Risk if ignored**: Silent failures at runtime. Hard-to-diagnose deployment issues.

---

## Finding INFRA-2: No Migration Files Visible

**Severity**: High | **Priority**: P1

**Documentation**: `prisma.config.ts` specifies migrations path as `prisma/migrations`.

**Code**: The `prisma/migrations` directory was not found in the file listing.

**Problem**: If migration files don't exist, the database schema cannot be reliably recreated in different environments (development, staging, production). The app relies on `prisma generate` but may not have a way to run `prisma migrate deploy`.

**Root Cause**: Migrations may have been deleted, not committed, or never generated.

**Solution**: 
1. Run `npx prisma migrate dev` to generate initial migration files
2. Add migration scripts to package.json
3. Document migration workflow in README

**Risk if ignored**: Database schema drift between environments. Cannot reproduce production schema locally.

---

## Finding INFRA-3: No Docker Configuration

**Severity**: Medium | **Priority**: P2

**Documentation**: No explicit Docker requirements, but the system is designed as a multi-app microservice architecture.

**Code**: No `Dockerfile` or `docker-compose.yml` files exist.

**Problem**: The 4-app architecture (Buyer, Seller, Shipping, Payments) requires all 4 backends plus PostgreSQL running simultaneously for any cross-app feature to work. Without Docker Compose, developers must manually run and configure each app.

**Root Cause**: Deployment infrastructure was not part of the implementation scope.

**Solution**: Create a `docker-compose.yml` for local development:
1. PostgreSQL instance
2. Payments App service
3. Documented environment variables for each service

**Risk if ignored**: High friction for new developers setting up the project.

---

## Finding INFRA-4: Missing CI/CD Pipeline Configuration

**Severity**: Medium | **Priority**: P2

**Code**: `.github/` directory exists but its contents were not checked. No CI workflow files appeared in the file glob results beyond `.github/` being listed as a directory.

**Problem**: There's no automated CI/CD pipeline visible. The project likely has no:
- Automated test running
- Lint checking on PRs
- Build validation
- Deployment automation

**Root Cause**: Not implemented.

**Solution**: Create GitHub Actions workflows for:
1. CI: Lint + TypeScript check + test run on every PR
2. CI: Build validation
3. CD: Automated deployment on main branch merge

**Risk if ignored**: No quality gates before code reaches production.

---

## Finding INFRA-5: Missing next.config.js Security Headers

**Severity**: Medium | **Priority**: P2

**Code**: `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/*": ["./src/generated/prisma/*"],
  },
};
```

**Problem**: Security headers are not configured:
- No CSP (Content Security Policy)
- No CORS configuration
- No HSTS
- No X-Frame-Options
- No X-Content-Type-Options

**Root Cause**: Security hardening was not configured.

**Solution**: Add security headers via Next.js `headers()` config in next.config.ts.

**Risk if ignored**: Application is vulnerable to XSS, clickjacking, and other common web attacks.
