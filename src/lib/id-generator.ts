import crypto from 'crypto'

const PREFIXES: Record<string, string> = {
  Payment: 'pay',
  PaymentStatusHistory: 'psh',
  PaymentAttempt: 'pat',
  Receipt: 'rec',
  Settlement: 'set',
  SettlementStatusHistory: 'ssh',
  Payout: 'pyt',
  Refund: 'ref',
  RefundStatusHistory: 'rsh',
  MpWebhookEvent: 'whe',
  OutboundCallLog: 'ocl',
}

function shortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}

export function generateId(model: string): string {
  const prefix = PREFIXES[model] || 'gen'
  return `${prefix}_${shortId()}`
}
