import MercadoPagoConfig, { Preference } from 'mercadopago'
import axios from 'axios'

function getAccessToken(): string | undefined {
  const isSandbox = process.env.MERCADOPAGO_SANDBOX_MODE === 'true'
  if (isSandbox) return process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN
  return process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN
}

export function getPublicKey(): string | undefined {
  const isSandbox = process.env.MERCADOPAGO_SANDBOX_MODE === 'true'
  if (isSandbox) return process.env.MERCADOPAGO_SANDBOX_PUBLIC_KEY || process.env.MERCADOPAGO_PUBLIC_KEY
  return process.env.MERCADOPAGO_PUBLIC_KEY || process.env.MERCADOPAGO_SANDBOX_PUBLIC_KEY
}

function getConfig() {
  const token = getAccessToken()
  if (!token) throw new Error('Mercado Pago access token not configured')
  return new MercadoPagoConfig({ accessToken: token, options: { timeout: 20000 } })
}

export async function createPreference(preference: Record<string, unknown>) {
  const config = getConfig()
  const client = new Preference(config)
  const resp = await client.create({ body: preference as any })
  return resp
}

async function fetchPaymentDetailsWithToken(paymentId: string, token: string) {
  const base = 'https://api.mercadopago.com'
  const url = `${base}/v1/payments/${encodeURIComponent(paymentId)}`
  const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 })
  return resp.data
}

function getPrimaryToken(): string | undefined {
  return getAccessToken()
}

function getFallbackToken(primary: string | undefined): string | undefined {
  const isSandbox = process.env.MERCADOPAGO_SANDBOX_MODE === 'true'
  const fb = isSandbox
    ? process.env.MERCADOPAGO_ACCESS_TOKEN
    : process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN
  return (fb && fb !== primary) ? fb : undefined
}

/**
 * Fetch payment details from Mercado Pago REST API.
 * Uses a direct HTTP call to ensure predictable behaviour across SDK versions.
 * Falls back to the other token (sandbox ↔ production) if the primary one returns 404.
 */
export async function fetchPaymentDetails(paymentId: string, _liveMode?: boolean) {
  const primaryToken = getPrimaryToken()

  if (!primaryToken) throw new Error('Mercado Pago access token not configured')

  try {
    return await fetchPaymentDetailsWithToken(paymentId, primaryToken)
  } catch (err: any) {
    const status = err?.response?.status
    if (status !== 404) throw err

    const fallbackToken = getFallbackToken(primaryToken)
    if (!fallbackToken) throw err

    try {
      return await fetchPaymentDetailsWithToken(paymentId, fallbackToken)
    } catch (fallbackErr: any) {
      throw fallbackErr
    }
  }
}

export async function getMerchantOrder(orderId: string, _liveMode?: boolean) {
  const primaryToken = getPrimaryToken()

  if (!primaryToken) throw new Error('Mercado Pago access token not configured')

  const base = 'https://api.mercadopago.com'
  const url = `${base}/merchant_orders/${encodeURIComponent(orderId)}`

  try {
    const resp = await axios.get(url, { headers: { Authorization: `Bearer ${primaryToken}` }, timeout: 20000 })
    return resp.data
  } catch (err: any) {
    const status = err?.response?.status
    if (status !== 404) throw err

    const fallbackToken = getFallbackToken(primaryToken)
    if (!fallbackToken) throw err

    try {
      const resp = await axios.get(url, { headers: { Authorization: `Bearer ${fallbackToken}` }, timeout: 20000 })
      return resp.data
    } catch (fallbackErr: any) {
      throw fallbackErr
    }
  }
}

/**
 * Process a refund via Mercado Pago API.
 * Refunds a payment partially or fully.
 * Returns the refund response from MP.
 */
export async function createRefund(paymentId: string, amountCents?: number) {
  const token = getAccessToken()
  if (!token) throw new Error('Mercado Pago access token not configured')

  const base = 'https://api.mercadopago.com'
  const url = `${base}/v1/payments/${encodeURIComponent(paymentId)}/refunds`
  const body: Record<string, unknown> = {}
  if (amountCents !== undefined && amountCents !== null) {
    body.amount = amountCents / 100
  }
  const resp = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    timeout: 20000,
  })
  return resp.data
}

export default { createPreference, getPublicKey, fetchPaymentDetails, createRefund, getMerchantOrder }
