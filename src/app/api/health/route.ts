import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { testMpConnectivity } from '@/services/mercado-pago.service'

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    sandbox_mode: process.env.MERCADOPAGO_SANDBOX_MODE === 'true',
  }

  // Database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true }
  } catch (err) {
    checks.database = { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // Mercado Pago connectivity
  try {
    const mpResult = await testMpConnectivity()
    checks.mercadopago = {
      ok: mpResult.connected,
      sandbox_mode: mpResult.sandbox_mode,
      token_prefix: mpResult.token_prefix,
      public_key_prefix: mpResult.public_key_prefix,
      webhook_url: mpResult.webhook_url,
      ...(mpResult.error ? { error: mpResult.error } : {}),
    }
  } catch (err) {
    checks.mercadopago = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }

  // Vercel environment info
  checks.vercel = {
    region: process.env.VERCEL_REGION || null,
    url: process.env.VERCEL_URL || null,
    environment: process.env.VERCEL_ENV || null,
  }

  // Clerk configuration
  checks.clerk = {
    issuer_configured: !!process.env.CLERK_ISSUER,
    publishable_key_configured: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !!process.env.CLERK_PUBLISHABLE_KEY,
    secret_key_configured: !!process.env.CLERK_SECRET_KEY,
    audience_configured: !!process.env.CLERK_AUDIENCE,
  }

  // Inter-app configuration
  checks.service_tokens = {
    buyer_to_payments: !!process.env.BUYER_TO_PAYMENTS_SERVICE_TOKEN,
    payments_to_buyer: !!process.env.PAYMENTS_TO_BUYER_SERVICE_TOKEN,
    payments_to_seller: !!process.env.PAYMENTS_TO_SELLER_SERVICE_TOKEN,
    shipping_to_payments: !!process.env.SHIPPING_TO_PAYMENTS_SERVICE_TOKEN,
  }

  const allOk = Object.entries(checks).every(([key, val]) => {
    if (key === 'timestamp' || key === 'environment' || key === 'sandbox_mode') return true
    if (typeof val === 'object' && val !== null) return (val as Record<string, unknown>).ok !== false
    return true
  })

  return NextResponse.json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
  }, { status: allOk ? 200 : 503 })
}
