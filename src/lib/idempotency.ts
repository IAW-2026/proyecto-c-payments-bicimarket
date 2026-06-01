import { prisma } from '@/lib/prisma'

export function extractIdempotencyKey(req: Request): string | undefined {
  try {
    const key = req.headers.get('Idempotency-Key') || req.headers.get('idempotency-key')
    return key?.toLowerCase() || undefined
  } catch {
    return undefined
  }
}

export async function findPaymentByKey(key: string) {
  return prisma.payment.findUnique({ where: { idempotency_key: key } })
}

export async function findRefundByKey(key: string) {
  return prisma.refund.findUnique({ where: { idempotency_key: key } })
}

export async function findReceiptByKey(key: string) {
  return prisma.receipt.findUnique({ where: { idempotency_key: key } })
}

export async function findPayoutByKey(key: string) {
  return prisma.payout.findUnique({ where: { idempotency_key: key } })
}
