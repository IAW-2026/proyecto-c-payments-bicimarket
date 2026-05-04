import { prisma } from '@/lib/prisma'

export function calculateSettlementAmounts(amount_cents: number, sellerSharePercent = 80) {
  const gross = amount_cents
  const fee = Math.round((100 - sellerSharePercent) / 100 * gross)
  const net = gross - fee
  return { gross, fee, net }
}

export async function createSettlementsForPayment(paymentId: string, sellers: Array<{ seller_profile_id: string, sharePercent?: number }>) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw new Error('Payment not found')

  const settlements = []
  for (const s of sellers) {
    const amounts = calculateSettlementAmounts(payment.amount_cents, s.sharePercent ?? 80)
    const set = await prisma.settlement.create({ data: {
      payment_id: payment.id,
      order_id: payment.order_id,
      order_seller_group_id: '',
      seller_profile_id: s.seller_profile_id,
      gross_amount_cents: amounts.gross,
      fee_amount_cents: amounts.fee,
      net_amount_cents: amounts.net,
    }})
    settlements.push(set)
  }
  return settlements
}
