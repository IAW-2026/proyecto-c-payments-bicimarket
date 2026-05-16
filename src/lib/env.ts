interface EnvVar {
  name: string
  required: boolean
  description: string
}

const REQUIRED_VARS: EnvVar[] = [
  { name: 'DATABASE_URL', required: true, description: 'PostgreSQL connection string' },
  { name: 'DIRECT_URL', required: true, description: 'Direct PostgreSQL connection for migrations' },
  { name: 'MERCADOPAGO_ACCESS_TOKEN', required: true, description: 'Mercado Pago API access token' },
  { name: 'MERCADOPAGO_PUBLIC_KEY', required: true, description: 'Mercado Pago public key' },
  { name: 'MERCADOPAGO_WEBHOOK_SECRET', required: true, description: 'Mercado Pago webhook signature secret' },
  { name: 'BUYER_TO_PAYMENTS_SERVICE_TOKEN', required: true, description: 'Service token for Buyer→Payments calls' },
  { name: 'SHIPPING_TO_PAYMENTS_SERVICE_TOKEN', required: true, description: 'Service token for Shipping→Payments calls' },
  { name: 'SELLER_TO_PAYMENTS_SERVICE_TOKEN', required: true, description: 'Service token for Seller→Payments calls' },
  { name: 'PAYMENTS_TO_BUYER_SERVICE_TOKEN', required: true, description: 'Service token for Payments→Buyer calls' },
  { name: 'PAYMENTS_TO_SELLER_SERVICE_TOKEN', required: true, description: 'Service token for Payments→Seller calls' },
  { name: 'BUYER_APP_URL', required: true, description: 'Buyer app base URL' },
  { name: 'SELLER_APP_URL', required: true, description: 'Seller app base URL' },
  { name: 'CLERK_PUBLISHABLE_KEY', required: true, description: 'Clerk publishable key' },
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
