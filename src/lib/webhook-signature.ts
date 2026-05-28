import crypto from 'crypto'

export interface SignatureParts {
  ts: string
  v1: string
}

export function parseSignatureHeader(header: string): SignatureParts | null {
  if (!header || typeof header !== 'string') return null

  const parts: Record<string, string> = {}
  for (const rawPart of header.split(',')) {
    const part = rawPart.trim()
    if (!part) continue

    const [rawKey, ...rest] = part.split('=')
    if (!rawKey || rest.length === 0) continue

    const key = rawKey.trim().toLowerCase()
    let value = rest.join('=').trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if ((key === 'ts' || key === 'v1') && !(key in parts)) {
      parts[key] = value
    }
  }

  if (!parts.ts || !/^[0-9]+$/.test(parts.ts)) return null
  if (!parts.v1 || !/^[0-9a-f]{64}$/i.test(parts.v1)) return null

  return { ts: parts.ts, v1: parts.v1 }
}

function computeHmacSha256Hex(key: string, data: string): string {
  return crypto
    .createHmac('sha256', key)
    .update(data, 'utf8')
    .digest('hex')
}

function buildSignatureManifest(dataId: string | null, xRequestId: string | null, ts: string): string {
  let manifest = ''

  if (dataId) {
    manifest += `id:${dataId.toLowerCase()};`
  }
  if (xRequestId && xRequestId.trim() !== '') {
    manifest += `request-id:${xRequestId};`
  }

  manifest += `ts:${ts};`
  return manifest
}

function constantTimeEqualsHex(expectedHex: string, receivedHex: string): boolean {
  if (!/^[0-9a-f]+$/i.test(expectedHex) || !/^[0-9a-f]+$/i.test(receivedHex)) {
    return false
  }
  const expected = Buffer.from(expectedHex, 'hex')
  const received = Buffer.from(receivedHex, 'hex')

  if (expected.length !== received.length) {
    return false
  }
  return crypto.timingSafeEqual(expected, received)
}

/**
 * Validate signature for payment topic webhooks.
 * Manifest format: id:{data.id};request-id:{x-request-id};ts:{ts};
 * Source: https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/payment-notifications
 */
export function validatePaymentWebhookSignature(
  signatureHeader: string | null,
  xRequestId: string | null,
  dataId: string | null,
): { valid: boolean; ts: string | null } {
  if (!signatureHeader) {
    console.warn('[WebhookSignature] Missing x-signature header')
    return { valid: false, ts: null }
  }

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) {
    console.warn('[WebhookSignature] Could not parse x-signature header:', signatureHeader)
    return { valid: false, ts: null }
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[WebhookSignature] MERCADOPAGO_WEBHOOK_SECRET is not configured')
    return { valid: false, ts: parsed.ts }
  }

  if (!dataId) {
    console.warn('[WebhookSignature] Missing data.id — cannot validate')
    return { valid: false, ts: parsed.ts }
  }

  const manifest = buildSignatureManifest(dataId, xRequestId, parsed.ts)
  const expectedSignature = computeHmacSha256Hex(secret, manifest)

  if (constantTimeEqualsHex(expectedSignature, parsed.v1)) {
    return { valid: true, ts: parsed.ts }
  }

  console.warn(`[WebhookSignature] Signature mismatch. Generated manifest: "${manifest}"`)
  return { valid: false, ts: parsed.ts }
}

/**
 * Validate signature for orders topic webhooks.
 * Manifest format: id:{data.id};request-id:{x-request-id};ts:{ts};
 * Source: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications
 */
export function validateMercadoPagoSignature(
  signatureHeader: string | null,
  xRequestId: string | null,
  dataId: string | null,
): { valid: boolean; ts: string | null } {
  if (!signatureHeader) {
    console.warn('[WebhookSignature] Missing x-signature header')
    return { valid: false, ts: null }
  }

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) {
    console.warn('[WebhookSignature] Could not parse x-signature header:', signatureHeader)
    return { valid: false, ts: null }
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[WebhookSignature] MERCADOPAGO_WEBHOOK_SECRET is not configured')
    return { valid: false, ts: parsed.ts }
  }

  const manifest = buildSignatureManifest(dataId, xRequestId, parsed.ts)
  const expectedSignature = computeHmacSha256Hex(secret, manifest)

  if (constantTimeEqualsHex(expectedSignature, parsed.v1)) {
    return { valid: true, ts: parsed.ts }
  }

  console.warn(`[WebhookSignature] Signature mismatch. Generated manifest: "${manifest}"`)
  return { valid: false, ts: parsed.ts }
}

/**
 * Check if the signature timestamp is within a freshness window.
 * Prevents replay attacks by rejecting old notifications.
 */
export function isTimestampFresh(ts: string, maxAgeSeconds = 300): boolean {
  const now = Math.floor(Date.now() / 1000)
  const sigTime = parseInt(ts, 10)
  if (isNaN(sigTime)) return false
  return (now - sigTime) <= maxAgeSeconds
}
