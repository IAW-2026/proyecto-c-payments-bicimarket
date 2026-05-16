import axios from 'axios'

const MP_API = 'https://api.mercadopago.com'

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN is not configured')
  return token
}

function api() {
  return axios.create({
    baseURL: MP_API,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  })
}

export interface CheckoutPreferenceInput {
  amount_cents: number
  external_reference: string
  buyer_email?: string
  items: Array<{ title: string; quantity: number; unit_price_cents: number; description?: string }>
  return_urls?: {
    success?: string
    failure?: string
    pending?: string
  }
}

export interface CheckoutPreferenceResult {
  id: string
  init_point: string
  sandbox_init_point: string
}

export interface MpPaymentResult {
  id: string
  status: 'approved' | 'rejected' | 'in_process' | 'pending' | 'cancelled' | 'refunded'
  status_detail: string
  payment_method_id: string
  payment_type_id: string
  card: { last_four_digits?: string } | null
  transaction_amount: number
  currency_id: string
  external_reference: string | null
  date_approved: string | null
  date_created: string
}

export interface MpTransferResult {
  id: string
  status: 'approved' | 'pending' | 'cancelled' | 'failed'
  amount: number
  date_created: string
}

export interface MpRefundResult {
  id: string
  status: 'approved' | 'pending' | 'rejected'
  amount: number
  date_created: string
}

export async function createCheckoutPreference(input: CheckoutPreferenceInput): Promise<CheckoutPreferenceResult> {
  const amount = input.amount_cents / 100

  const items = input.items.length > 0
    ? input.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price_cents / 100,
        currency_id: 'ARS',
        description: item.description || '',
      }))
    : [{ title: 'Compra BiciMarket', quantity: 1, unit_price: amount, currency_id: 'ARS' }]

  const body: Record<string, unknown> = {
    items,
    external_reference: input.external_reference,
    auto_return: 'approved',
    back_urls: {
      success: input.return_urls?.success || '',
      failure: input.return_urls?.failure || '',
      pending: input.return_urls?.pending || '',
    },
    payment_methods: {
      excluded_payment_types: [],
      installments: 12,
    },
    statement_descriptor: 'BICIMARKET',
  }

  if (input.buyer_email) {
    body.payer = { email: input.buyer_email }
  }

  const { data } = await api().post('/checkout/preferences', body)
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
  }
}

export async function getPayment(paymentId: string): Promise<MpPaymentResult> {
  const { data } = await api().get(`/v1/payments/${paymentId}`)
  return {
    id: String(data.id),
    status: data.status,
    status_detail: data.status_detail,
    payment_method_id: data.payment_method_id,
    payment_type_id: data.payment_type_id,
    card: data.card || null,
    transaction_amount: data.transaction_amount,
    currency_id: data.currency_id,
    external_reference: data.external_reference,
    date_approved: data.date_approved,
    date_created: data.date_created,
  }
}

export async function createTransfer(collectorId: string, amountCents: number, description?: string): Promise<MpTransferResult> {
  const { data } = await api().post('/v1/transfers', {
    collector_id: collectorId,
    amount: amountCents / 100,
    currency_id: 'ARS',
    description: description || 'Liquidación BiciMarket',
  })
  return {
    id: String(data.id),
    status: data.status,
    amount: data.amount,
    date_created: data.date_created,
  }
}

export async function processRefund(paymentGatewayReference: string, amountCents?: number): Promise<MpRefundResult> {
  const body: Record<string, unknown> = {}
  if (amountCents) {
    body.amount = amountCents / 100
  }
  const { data } = await api().post(`/v1/payments/${paymentGatewayReference}/refunds`, body)
  return {
    id: String(data.id),
    status: data.status,
    amount: data.amount,
    date_created: data.date_created,
  }
}
