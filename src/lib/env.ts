interface EnvVar {
  name: string
  required: boolean
  description: string
}

const REQUIRED_VARS: EnvVar[] = [
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  { name: 'DIRECT_URL', required: true, description: 'Direct PostgreSQL connection for migrations' },
  { name: 'MERCADOPAGO_ACCESS_TOKEN', required: false, description: 'Mercado Pago API access token (production, required unless using sandbox token)' },
  { name: 'MERCADOPAGO_PUBLIC_KEY', required: false, description: 'Mercado Pago public key (production)' },
  { name: 'MERCADOPAGO_SANDBOX_ACCESS_TOKEN', required: false, description: 'Mercado Pago sandbox API access token (TEST_...)' },
  { name: 'MERCADOPAGO_SANDBOX_PUBLIC_KEY', required: false, description: 'Mercado Pago sandbox public key (TEST_...)' },
  { name: 'MERCADOPAGO_WEBHOOK_SECRET', required: false, description: 'Mercado Pago webhook signature secret' },
  { name: 'MERCADOPAGO_SANDBOX_MODE', required: false, description: 'Set to true to use sandbox endpoints' },
  { name: 'BUYER_TO_PAYMENTS_SERVICE_TOKEN', required: true, description: 'Service token for Buyer→Payments calls' },
  { name: 'SHIPPING_TO_PAYMENTS_SERVICE_TOKEN', required: true, description: 'Service token for Shipping→Payments calls' },
  { name: 'SELLER_TO_PAYMENTS_SERVICE_TOKEN', required: true, description: 'Service token for Seller→Payments calls' },
  { name: 'PAYMENTS_TO_BUYER_SERVICE_TOKEN', required: true, description: 'Service token for Payments→Buyer calls' },
  { name: 'PAYMENTS_TO_SELLER_SERVICE_TOKEN', required: true, description: 'Service token for Payments→Seller calls' },
  { name: 'BUYER_APP_URL', required: true, description: 'Buyer app base URL' },
  { name: 'SELLER_APP_URL', required: true, description: 'Seller app base URL' },
  { name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', required: false, description: 'Clerk publishable key (public, NEXT_PUBLIC_ prefix)' },
  { name: 'CLERK_PUBLISHABLE_KEY', required: false, description: 'Clerk publishable key (server, fallback)' },
  { name: 'CLERK_SECRET_KEY', required: true, description: 'Clerk secret key' },
  { name: 'CLERK_ISSUER', required: true, description: 'Clerk issuer URL' },
  { name: 'CLERK_AUDIENCE', required: true, description: 'Clerk JWT audience' },
]

export function validateEnv(): string[] {
  const missing: string[] = []

  for (const v of REQUIRED_VARS) {
    if (v.required && !process.env[v.name]) {
      missing.push(`${v.name} (${v.description})`)
    }
  }

  // Validate MP credentials: at least one set (sandbox or production) must be present
  const hasProductionToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN
  const hasSandboxToken = !!process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN
  const isSandboxMode = process.env.MERCADOPAGO_SANDBOX_MODE === 'true'

  if (!hasProductionToken && !hasSandboxToken) {
    missing.push('MERCADOPAGO_ACCESS_TOKEN or MERCADOPAGO_SANDBOX_ACCESS_TOKEN — at least one is required')
  }

  if (isSandboxMode && !hasSandboxToken) {
    console.warn('[Env] SANDBOX_MODE=true but MERCADOPAGO_SANDBOX_ACCESS_TOKEN is not set. Falling back to MERCADOPAGO_ACCESS_TOKEN.')
  }

  if (!isSandboxMode && !hasProductionToken) {
    missing.push('MERCADOPAGO_ACCESS_TOKEN — required when not in sandbox mode')
  }

  // Clerk publishable key: check both forms (NEXT_PUBLIC_ prefix or without)
  const hasClerkPubKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !!process.env.CLERK_PUBLISHABLE_KEY
  if (!hasClerkPubKey) {
    missing.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY — Clerk publishable key is required')
  }

  return missing
}

export function ensureEnv() {
  const missing = validateEnv()
  if (missing.length > 0) {
    console.error('Missing required environment variables:')
    missing.forEach(v => console.error(`  - ${v}`))
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing ${missing.length} required environment variables`)
    }
  }
  return missing
}
