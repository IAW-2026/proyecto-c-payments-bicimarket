/**
 * Calculate settlement amounts for a seller
 * Per spec: fee is 10% (not 20%) on the seller's gross amount (subtotal + shipping)
 * @param grossAmountCents - Seller's total (subtotal + shipping)
 * @param feePercentage - Fee percentage (default 10%)
 * @returns { gross, fee, net }
 */
export function calculateSettlementAmounts(grossAmountCents: number, feePercentage = 10) {
  const gross = grossAmountCents
  const fee = Math.round((feePercentage / 100) * gross)
  const net = gross - fee
  return { gross, fee, net }
}


