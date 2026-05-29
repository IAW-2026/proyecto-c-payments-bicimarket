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
  return new MercadoPagoConfig({ accessToken: token })
}

export async function createPreference(preference: Record<string, unknown>) {
  const config = getConfig()
  const client = new Preference(config)
  const resp = await client.create({ body: preference as any })
  return resp
}

/**
 * Fetch payment details from Mercado Pago REST API.
 * Uses a direct HTTP call to ensure predictable behaviour across SDK versions.
 */
export async function fetchPaymentDetails(paymentId: string) {
  const token = getAccessToken()
  if (!token) throw new Error('Mercado Pago access token not configured')

  const base = 'https://api.mercadopago.com'
  const url = `${base}/v1/payments/${encodeURIComponent(paymentId)}`
  const resp = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
  return resp.data
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
  })
  return resp.data
}

export default { createPreference, getPublicKey, fetchPaymentDetails, createRefund }
