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

export class MercadoPagoCredentialError extends MercadoPagoError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(401, 'CREDENTIAL_ERROR', message, details)
    this.name = 'MercadoPagoCredentialError'
  }
}

function isSandboxMode(): boolean {
  return process.env.MERCADOPAGO_SANDBOX_MODE === 'true'
}

function getAccessToken(): string {
  const token = isSandboxMode()
    ? (process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN)
    : process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) {
    const varName = isSandboxMode() ? 'MERCADOPAGO_SANDBOX_ACCESS_TOKEN (or MERCADOPAGO_ACCESS_TOKEN)' : 'MERCADOPAGO_ACCESS_TOKEN'
    throw new MercadoPagoCredentialError(`${varName} is not configured`)
  }
  return token
}

function getPublicKey(): string {
  const key = isSandboxMode()
    ? (process.env.MERCADOPAGO_SANDBOX_PUBLIC_KEY || process.env.MERCADOPAGO_PUBLIC_KEY)
    : process.env.MERCADOPAGO_PUBLIC_KEY
  if (!key) {
    const varName = isSandboxMode() ? 'MERCADOPAGO_SANDBOX_PUBLIC_KEY (or MERCADOPAGO_PUBLIC_KEY)' : 'MERCADOPAGO_PUBLIC_KEY'
    console.warn(`[MP] ${varName} is not configured - SDK initialization may fail`)
  }
  return key || ''
}

function getWebhookUrl(): string | undefined {
  if (isSandboxMode()) {
    return process.env.MERCADOPAGO_SANDBOX_WEBHOOK_URL || process.env.MERCADOPAGO_WEBHOOK_URL || undefined
  }
  return process.env.MERCADOPAGO_WEBHOOK_URL || undefined
}

function api() {
  const token = getAccessToken()
  console.debug(`[MP] Creating API client | sandbox=${isSandboxMode()} | token_prefix=${token.substring(0, 10)}...`)
  return axios.create({
    baseURL: MP_API,
    headers: {
      Authorization: `Bearer ${token}`,
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

    // Detect credential errors specifically
    if (status === 401 || status === 403) {
      console.error(`[MP ${context}] CREDENTIAL ERROR: Check your MERCADOPAGO_ACCESS_TOKEN.`, {
        status,
        mpCode,
        mpMessage,
        sandboxMode: isSandboxMode(),
        tokenPrefix: process.env.MERCADOPAGO_ACCESS_TOKEN?.substring(0, 10),
        sandboxTokenPrefix: process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN?.substring(0, 10),
      })
      throw new MercadoPagoCredentialError(
        `Mercado Pago ${context} failed with auth error (${status}). Verify your access token is correct for ${isSandboxMode() ? 'SANDBOX' : 'PRODUCTION'} mode.`,
        { status, mpCode, sandboxMode: isSandboxMode() }
      )
    }

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
  sandbox_mode: boolean
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
    const sandboxMode = isSandboxMode()

    const items = input.items.length > 0
      ? input.items.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price_cents / 100,
          currency_id: 'ARS',
          description: item.description || '',
        }))
      : [{ title: 'Compra BiciMarket', quantity: 1, unit_price: amount, currency_id: 'ARS' }]

    const hasReturnUrls = !!(input.return_urls?.success || input.return_urls?.failure || input.return_urls?.pending)

    const body: Record<string, unknown> = {
      items,
      external_reference: input.external_reference,
      ...(hasReturnUrls ? {
        auto_return: 'approved',
        back_urls: {
          ...(input.return_urls?.success ? { success: input.return_urls.success } : {}),
          ...(input.return_urls?.failure ? { failure: input.return_urls.failure } : {}),
          ...(input.return_urls?.pending ? { pending: input.return_urls.pending } : {}),
        },
      } : {}),
      notification_url: getWebhookUrl(),
      metadata: {
        sandbox_mode: sandboxMode,
        platform: 'bicimarket-payments',
      },
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
        installments: 12,
        default_installments: 1,
      },
      statement_descriptor: 'BICIMARKET',
    }

    body.payer = {
      email: input.buyer_email || 'test_user@testuser.com',
    }

    if (!sandboxMode) {
      (body.payer as Record<string, unknown>).identification = {
        type: 'DNI',
        number: '12345678',
      }
    }

    console.debug(`[MP] Creating preference | sandbox=${sandboxMode} | amount=${amount} | ext_ref=${input.external_reference}`)
    console.debug('[MP] preference body:', JSON.stringify(body, null, 2))

    const { data } = await api().post('/checkout/preferences', body)

    const initPoint = sandboxMode ? data.sandbox_init_point : data.init_point

    console.info(`[MP] Preference created: ${data.id} | sandbox=${sandboxMode} | has_init_point=${!!data.init_point} | has_sandbox_init_point=${!!data.sandbox_init_point}`)
    console.info(`[MP] Using init_point: ${initPoint ? initPoint.substring(0, 80) + '...' : 'MISSING!'}`)

    if (sandboxMode && !data.sandbox_init_point) {
      console.warn('[MP] SANDBOX MODE but sandbox_init_point is empty! Using init_point fallback.')
      console.warn('[MP] Verify: (1) MERCADOPAGO_SANDBOX_ACCESS_TOKEN or MERCADOPAGO_ACCESS_TOKEN starts with TEST_')
      console.warn('[MP] Verify: (2) The test user belongs to the same application as the access token.')
    }

    return {
      id: data.id,
      init_point: initPoint || data.init_point,
      sandbox_init_point: data.sandbox_init_point,
      sandbox_mode: sandboxMode,
    }
  } catch (err) {
    return handleMpError(err, 'create preference')
  }
}

export async function getPayment(paymentId: string): Promise<MpPaymentResult> {
  try {
    console.debug(`[MP] Fetching payment: ${paymentId}`)
    const { data } = await api().get(`/v1/payments/${paymentId}`)
    console.info(`[MP] Payment ${paymentId}: status=${data.status} detail=${data.status_detail} ext_ref=${data.external_reference}`)
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
    console.info(`[MP] Creating transfer to collector=${collectorId} amount=${amountCents / 100}`)
    const { data } = await api().post('/v1/transfers', {
      collector_id: collectorId,
      amount: amountCents / 100,
      currency_id: 'ARS',
      description: description || 'Liquidación BiciMarket',
    })
    console.info(`[MP] Transfer created: ${data.id} status=${data.status}`)
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
    console.info(`[MP] Processing refund for payment=${paymentGatewayReference} amount=${amountCents ? amountCents / 100 : 'full'}`)
    const body: Record<string, unknown> = {}
    if (amountCents) {
      body.amount = amountCents / 100
    }
    const { data } = await api().post(`/v1/payments/${paymentGatewayReference}/refunds`, body)
    console.info(`[MP] Refund processed: ${data.id} status=${data.status}`)
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

/**
 * Test MP API connectivity and credential validity.
 * Used by the health check endpoint to diagnose sandbox/production issues.
 */
export async function testMpConnectivity(): Promise<{
  connected: boolean
  sandbox_mode: boolean
  token_prefix: string
  public_key_prefix: string
  error?: string
  webhook_url?: string
}> {
  try {
    const token = getAccessToken()
    const pubKey = getPublicKey()
    const sandboxMode = isSandboxMode()

    // Make a lightweight API call to test connectivity
    const { data } = await api().get('/v1/payment_methods')
    const methodCount = Array.isArray(data) ? data.length : 0

    return {
      connected: true,
      sandbox_mode: sandboxMode,
      token_prefix: token.substring(0, 14),
      public_key_prefix: pubKey.substring(0, 14) || 'not_configured',
      webhook_url: getWebhookUrl(),
      error: undefined,
    }
  } catch (err) {
    const sandboxMode = isSandboxMode()
    let errorMsg: string
    if (err instanceof MercadoPagoCredentialError) {
      errorMsg = `Credential error: ${err.message}`
    } else if (err instanceof MercadoPagoError) {
      errorMsg = `MP error: ${err.message} (code=${err.mpCode})`
    } else if (err instanceof Error) {
      errorMsg = err.message
    } else {
      errorMsg = 'Unknown error'
    }

    return {
      connected: false,
      sandbox_mode: sandboxMode,
      token_prefix: process.env.MERCADOPAGO_ACCESS_TOKEN?.substring(0, 14) || 'not_set',
      public_key_prefix: process.env.MERCADOPAGO_PUBLIC_KEY?.substring(0, 14) || 'not_set',
      error: errorMsg,
    }
  }
}
