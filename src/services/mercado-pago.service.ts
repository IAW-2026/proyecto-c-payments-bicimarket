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
  const sandboxToken = process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN ? `${process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN.slice(0, 12)}...` : '(not set)'
  const prodToken = process.env.MERCADOPAGO_ACCESS_TOKEN ? `${process.env.MERCADOPAGO_ACCESS_TOKEN.slice(0, 12)}...` : '(not set)'
  const isSandboxMode = process.env.MERCADOPAGO_SANDBOX_MODE === 'true'

  const primaryToken = getPrimaryToken()

  console.log(`[MP:fetchPaymentDetails] paymentId=${paymentId} isSandboxMode=${isSandboxMode} sandboxToken=${sandboxToken} prodToken=${prodToken}`)
  console.log(`[MP:fetchPaymentDetails] primary prefix=${primaryToken ? primaryToken.slice(0, 12) + '...' : '(none)'}`)

  if (!primaryToken) throw new Error('Mercado Pago access token not configured')

  try {
    return await fetchPaymentDetailsWithToken(paymentId, primaryToken)
  } catch (err: any) {
    const status = err?.response?.status
    const mpMessage = err?.response?.data?.message || err?.message || String(err)
    console.log(`[MP:fetchPaymentDetails] Token attempt failed: status=${status} message="${mpMessage}"`)

    if (status !== 404) throw err

    const fallbackToken = getFallbackToken(primaryToken)
    if (!fallbackToken) {
      console.log(`[MP:fetchPaymentDetails] No fallback token available (different from primary)`)
      throw err
    }

    console.log(`[MP:fetchPaymentDetails] Trying fallback prefix=${fallbackToken.slice(0, 12)}...`)
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

export async function getMerchantOrder(orderId: string, _liveMode?: boolean) {
  const primaryToken = getPrimaryToken()
  const isSandboxMode = process.env.MERCADOPAGO_SANDBOX_MODE === 'true'

  console.log(`[MP:getMerchantOrder] orderId=${orderId} isSandboxMode=${isSandboxMode} primary=${primaryToken ? primaryToken.slice(0, 12) + '...' : '(none)'}`)

  if (!primaryToken) throw new Error('Mercado Pago access token not configured')

  const base = 'https://api.mercadopago.com'
  const url = `${base}/merchant_orders/${encodeURIComponent(orderId)}`

  try {
    const resp = await axios.get(url, { headers: { Authorization: `Bearer ${primaryToken}` }, timeout: 10000 })
    return resp.data
  } catch (err: any) {
    const status = err?.response?.status
    const mpMessage = err?.response?.data?.message || err?.message || String(err)
    console.log(`[MP:getMerchantOrder] Token attempt failed: status=${status} message="${mpMessage}"`)

    if (status !== 404) throw err

    const fallbackToken = getFallbackToken(primaryToken)
    if (!fallbackToken) {
      console.log(`[MP:getMerchantOrder] No fallback token available`)
      throw err
    }

    console.log(`[MP:getMerchantOrder] Trying fallback prefix=${fallbackToken.slice(0, 12)}...`)
    try {
      const resp = await axios.get(url, { headers: { Authorization: `Bearer ${fallbackToken}` }, timeout: 10000 })
      return resp.data
    } catch (fallbackErr: any) {
      const fbStatus = fallbackErr?.response?.status
      const fbMsg = fallbackErr?.response?.data?.message || fallbackErr?.message || String(fallbackErr)
      console.log(`[MP:getMerchantOrder] Fallback also failed: status=${fbStatus} message="${fbMsg}"`)
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
    timeout: 10000,
  })
  return resp.data
}

export default { createPreference, getPublicKey, fetchPaymentDetails, createRefund, getMerchantOrder }
