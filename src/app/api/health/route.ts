import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

  return NextResponse.json({
    status: 'ok',
    checks,
  })
  
}
