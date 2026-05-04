import { prisma } from '@/lib/prisma'

export async function findByIdempotencyKey(key?: string) {
  if (!key) return null
  return prisma.payment.findFirst({ where: { idempotency_key: key } })
}

export function extractIdempotencyKey(req: Request) {
  // Headers may be lowercased in Node; Next's Request headers use get()
  try {
    // @ts-ignore
    const key = req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key')
    return key || undefined
  } catch (e) {
    return undefined
  }
}
