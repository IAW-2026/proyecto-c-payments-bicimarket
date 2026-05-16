export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'

const TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['refunded'],
  rejected: [],
  cancelled: [],
  refunded: [],
}

export function isValidPaymentTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function validatePaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!isValidPaymentTransition(from, to)) {
    throw new InvalidTransitionError('payment', from, to)
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly entity: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid ${entity} transition: ${from} → ${to}`)
    this.name = 'InvalidTransitionError'
  }
}
