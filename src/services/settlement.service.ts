import { prisma } from '@/lib/prisma'

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

/**
 * Create settlements for each seller from payment items_summary
 * Per spec (docs/03-apis.md): items_summary contains per-seller breakdown
 * Each settlement is: gross = seller.subtotal_cents + seller.shipping_cost_cents
 * Fee = 10% of gross, net = gross - fee
 * 
 * @param paymentId - Payment ID
 * @param itemsSummary - Array of { seller_profile_id, subtotal_cents, shipping_cost_cents }
 * @param orderSellerGroupMapping - Map of seller to order_seller_group_id from order data
 */
export async function createSettlementsForPayment(
  paymentId: string,
  itemsSummary: Array<{
    seller_profile_id: string
    subtotal_cents: number
    shipping_cost_cents: number
  }>,
  orderSellerGroupMapping?: Record<string, string>
) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw new Error('Payment not found')

  const settlements = []
  
  for (const item of itemsSummary) {
    // Seller's total = items subtotal + shipping cost
    const sellerGrossAmount = item.subtotal_cents + item.shipping_cost_cents
    
    // Calculate fee (10%) and net
    const amounts = calculateSettlementAmounts(sellerGrossAmount, 10)
    
    // Get order_seller_group_id from mapping, or construct from payment
    const orderSellerGroupId = orderSellerGroupMapping?.[item.seller_profile_id] || `osg_${paymentId}_${item.seller_profile_id}`
    
    const settlement = await prisma.settlement.create({
      data: {
        payment_id: paymentId,
        order_id: payment.order_id,
        order_seller_group_id: orderSellerGroupId,
        seller_profile_id: item.seller_profile_id,
        gross_amount_cents: amounts.gross,
        fee_amount_cents: amounts.fee,
        net_amount_cents: amounts.net,
        currency: payment.currency,
        status: 'pending'
      }
    })
    
    settlements.push(settlement)
  }
  
  return settlements
}
