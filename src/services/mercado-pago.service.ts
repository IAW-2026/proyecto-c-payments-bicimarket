import axios from 'axios'

const MP_API = 'https://api.mercadopago.com'

export async function createCheckoutPreference(data: any) {
  // Placeholder: in real implementation use MP_ACCESS_TOKEN
  // Expect data to include amount, external_reference
  const prefId = `mp_pref_${Date.now()}`
  const initPoint = `https://www.mercadopago.com/checkout/v1/redirect?pref_id=${prefId}`
  return { id: prefId, init_point: initPoint }
}

export async function getPayment(paymentId: string) {
  // Placeholder for GET /v1/payments/${paymentId}
  return { id: paymentId, status: 'approved' }
}

export async function createTransfer(body: any) {
  // Placeholder for transfer creation
  return { transfer_id: 'mp_transfer_mock' }
}
