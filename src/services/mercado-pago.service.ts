import MercadoPagoConfig, { Preference } from 'mercadopago'
import axios from 'axios'

function getAccessToken(): string | undefined {
  const isSandbox = process.env.MERCADOPAGO_SANDBOX_MODE === 'true'
  if (isSandbox) return process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN
  return process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN
}

function getAccessTokenForLiveMode(liveMode: boolean): string | undefined {
  if (liveMode === false) {
    return process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN
  }
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
  return new MercadoPagoConfig({ accessToken: token, options: { timeout: 10000 } })
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
  const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 })
  return resp.data
}

/**
 * Fetch payment details from Mercado Pago REST API.
 * Uses a direct HTTP call to ensure predictable behaviour across SDK versions.
 * Falls back to the other token (sandbox ↔ production) if the primary one returns 404.
 */
export async function fetchPaymentDetails(paymentId: string, liveMode?: boolean) {
  const primaryToken = liveMode !== undefined
    ? getAccessTokenForLiveMode(liveMode)
    : getAccessToken()

  if (!primaryToken) throw new Error('Mercado Pago access token not configured')

  try {
    return await fetchPaymentDetailsWithToken(paymentId, primaryToken)
  } catch (err: any) {
    if (err?.response?.status !== 404) throw err

    const fallbackToken = liveMode !== undefined
      ? getAccessTokenForLiveMode(!liveMode)
      : getAccessToken() === primaryToken
        ? undefined
        : getAccessToken()

    if (!fallbackToken || fallbackToken === primaryToken) throw err

    console.warn(`[MP] Payment ${paymentId} not found with primary token, trying fallback`)
    return await fetchPaymentDetailsWithToken(paymentId, fallbackToken)
  }
}

export async function getMerchantOrder(orderId: string, liveMode?: boolean) {
  const primaryToken = liveMode !== undefined
    ? getAccessTokenForLiveMode(liveMode)
    : getAccessToken()
  if (!primaryToken) throw new Error('Mercado Pago access token not configured')

  const base = 'https://api.mercadopago.com'
  const url = `${base}/merchant_orders/${encodeURIComponent(orderId)}`

  try {
    const resp = await axios.get(url, { headers: { Authorization: `Bearer ${primaryToken}` }, timeout: 10000 })
    return resp.data
  } catch (err: any) {
    if (err?.response?.status !== 404) throw err

    const fallbackToken = liveMode !== undefined
      ? getAccessTokenForLiveMode(!liveMode)
      : getAccessToken() === primaryToken
        ? undefined
        : getAccessToken()

    if (!fallbackToken || fallbackToken === primaryToken) throw err

    console.warn(`[MP] Merchant order ${orderId} not found with primary token, trying fallback`)
    const resp = await axios.get(url, { headers: { Authorization: `Bearer ${fallbackToken}` }, timeout: 10000 })
    return resp.data
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
    timeout: 10000,
  })
  return resp.data
}

export default { createPreference, getPublicKey, fetchPaymentDetails, createRefund, getMerchantOrder }
