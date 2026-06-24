import { InvalidTransitionError } from './payment'

export type SettlementStatus = 'pending' | 'paid' | 'failed' | 'manual_review'

const TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  pending: ['paid', 'failed'],
  paid: [],
  failed: ['paid', 'manual_review'],
  manual_review: [],
}

export function isValidSettlementTransition(from: SettlementStatus, to: SettlementStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function validateSettlementTransition(from: SettlementStatus, to: SettlementStatus): void {
  if (!isValidSettlementTransition(from, to)) {
    throw new InvalidTransitionError('settlement', from, to)
  }
}
