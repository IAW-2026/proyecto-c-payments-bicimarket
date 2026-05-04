import axios from 'axios'

export async function notifyBuyerPaymentStatus(buyerBaseUrl: string, orderId: string, status: string) {
  // Example: PATCH buyer service /api/v1/orders/{orderId}/payment-status
  try {
    const res = await axios.patch(`${buyerBaseUrl}/api/v1/orders/${orderId}/payment-status`, { status })
    return res.data
  } catch (err: any) {
    throw err
  }
}

export async function createSellerOrders(sellerBaseUrl: string, payload: any) {
  try {
    const res = await axios.post(`${sellerBaseUrl}/api/v1/sales-orders`, payload)
    return res.data
  } catch (err: any) {
    throw err
  }
}
