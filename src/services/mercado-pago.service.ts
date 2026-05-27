import axios, { AxiosError } from 'axios'

const MP_API = 'https://api.mercadopago.com'

export class MercadoPagoError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly mpCode: string | undefined,
    message: string,
    public readonly mpDetails?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'MercadoPagoError'
  }
}

function isSandboxMode(): boolean {
  return process.env.MERCADOPAGO_SANDBOX_MODE === 'true'
}

function getAccessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new MercadoPagoError(500, 'CONFIG_ERROR', 'MERCADOPAGO_ACCESS_TOKEN is not configured')
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

function handleMpError(err: unknown, context: string): never {
  if (err instanceof MercadoPagoError) throw err

  if (err instanceof AxiosError) {
    const status = err.response?.status || 502
    const mpErr = err.response?.data as Record<string, unknown> | undefined
    const mpCode = typeof mpErr?.error === 'string' ? mpErr.error as string : 'MP_API_ERROR'
    const mpMessage = typeof mpErr?.message === 'string' ? mpErr.message as string : err.message

    console.error(`[MP ${context}]`, { status, mpCode, mpMessage, mpErr })

    throw new MercadoPagoError(
      status >= 500 ? 502 : status,
      mpCode,
      `Mercado Pago ${context} failed: ${mpMessage}`,
      mpErr as Record<string, unknown> | undefined,
    )
  }

  const error = err instanceof Error ? err : new Error(String(err))
  console.error(`[MP ${context}] unexpected error:`, error)
  throw new MercadoPagoError(502, 'UNEXPECTED_ERROR', `Mercado Pago ${context} failed unexpectedly`)
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
  try {
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
      ...(input.return_urls?.success ? {
        auto_return: 'approved',
        back_urls: {
          success: input.return_urls.success,
          failure: input.return_urls.failure || '',
          pending: input.return_urls.pending || '',
        },
      } : {}),
      notification_url: process.env.MERCADOPAGO_WEBHOOK_URL || undefined,
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
        installments: 12,
        default_installments: 1,
      },
      statement_descriptor: 'BICIMARKET',
    }

    if (input.buyer_email) {
      body.payer = { email: input.buyer_email }
    }

    console.debug('[MP] preference body:', JSON.stringify(body, null, 2))

    const { data } = await api().post('/checkout/preferences', body)

    console.info(`[MP] Preference created: ${data.id} (sandbox: ${!!data.sandbox_init_point})`)

    return {
      id: data.id,
      init_point: isSandboxMode() ? data.sandbox_init_point : data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    }
  } catch (err) {
    return handleMpError(err, 'create preference')
  }
}

export async function getPayment(paymentId: string): Promise<MpPaymentResult> {
  try {
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
  } catch (err) {
    return handleMpError(err, `get payment ${paymentId}`)
  }
}

export async function createTransfer(collectorId: string, amountCents: number, description?: string): Promise<MpTransferResult> {
  try {
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
  } catch (err) {
    return handleMpError(err, `create transfer to ${collectorId}`)
  }
}

export async function processRefund(paymentGatewayReference: string, amountCents?: number): Promise<MpRefundResult> {
  try {
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
  } catch (err) {
    return handleMpError(err, `refund payment ${paymentGatewayReference}`)
  }
}
