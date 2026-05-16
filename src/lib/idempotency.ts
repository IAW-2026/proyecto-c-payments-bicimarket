import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export function extractIdempotencyKey(req: Request): string | undefined {
  try {
    const key = req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key')
    return key || undefined
  } catch {
    return undefined
  }
}

export async function findByIdempotencyKey(key?: string) {
  if (!key) return null
  return prisma.payment.findFirst({ where: { idempotency_key: key } })
}

export async function checkIdempotency(key: string): Promise<{ cached: true; response: NextResponse } | { cached: false }> {
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } })
  if (existing) {
    return {
      cached: true,
      response: NextResponse.json(existing.response, { status: existing.status }),
    }
  }
  return { cached: false }
}

export async function cacheIdempotencyResponse(
  key: string,
  responseBody: unknown,
  status: number,
): Promise<void> {
  await prisma.idempotencyKey.create({
    data: {
      key,
      response: responseBody as Record<string, unknown>,
      status,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
    },
  })
}
