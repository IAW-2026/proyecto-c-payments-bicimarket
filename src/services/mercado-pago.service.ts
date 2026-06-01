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
  const sandboxToken = process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN ? `${process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN.slice(0, 12)}...` : '(not set)'
  const prodToken = process.env.MERCADOPAGO_ACCESS_TOKEN ? `${process.env.MERCADOPAGO_ACCESS_TOKEN.slice(0, 12)}...` : '(not set)'
  const isSandboxMode = process.env.MERCADOPAGO_SANDBOX_MODE === 'true'

  console.log(`[MP:fetchPaymentDetails] paymentId=${paymentId} liveMode=${liveMode} isSandboxMode=${isSandboxMode} sandboxToken=${sandboxToken} prodToken=${prodToken}`)

  const primaryToken = liveMode !== undefined
    ? getAccessTokenForLiveMode(liveMode)
    : getAccessToken()

  if (!primaryToken) throw new Error('Mercado Pago access token not configured')

  console.log(`[MP:fetchPaymentDetails] primaryToken prefix=${primaryToken.slice(0, 12)}...`)

  try {
    return await fetchPaymentDetailsWithToken(paymentId, primaryToken)
  } catch (err: any) {
    const status = err?.response?.status
    const mpMessage = err?.response?.data?.message || err?.message || String(err)
    console.log(`[MP:fetchPaymentDetails] Token attempt failed: status=${status} message="${mpMessage}"`)

    if (status !== 404) throw err

    const fallbackToken = liveMode !== undefined
      ? getAccessTokenForLiveMode(!liveMode)
      : getAccessToken() === primaryToken
        ? undefined
        : getAccessToken()

    if (!fallbackToken) {
      console.log(`[MP:fetchPaymentDetails] No fallback token available`)
      throw err
    }

    if (fallbackToken === primaryToken) {
      console.log(`[MP:fetchPaymentDetails] Fallback token is identical to primary, skipping`)
      throw err
    }

    console.log(`[MP:fetchPaymentDetails] Trying fallback token prefix=${fallbackToken.slice(0, 12)}... (different from primary: ${fallbackToken !== primaryToken})`)
    try {
      return await fetchPaymentDetailsWithToken(paymentId, fallbackToken)
    } catch (fallbackErr: any) {
      const fbStatus = fallbackErr?.response?.status
      const fbMsg = fallbackErr?.response?.data?.message || fallbackErr?.message || String(fallbackErr)
      console.log(`[MP:fetchPaymentDetails] Fallback also failed: status=${fbStatus} message="${fbMsg}"`)
      throw fallbackErr
    }
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
