import crypto from 'crypto'

export interface SignatureParts {
  ts: string
  v1: string
}

export function parseSignatureHeader(header: string): SignatureParts | null {
  const parts: Record<string, string> = {}
  for (const part of header.split(',')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const key = part.slice(0, eqIdx).trim()
    const value = part.slice(eqIdx + 1).trim()
    parts[key] = value
  }
  if (!parts.ts || !parts.v1) return null
  return { ts: parts.ts, v1: parts.v1 }
}

function computeHmacSha256Hex(secret: string, data: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('hex')
}

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false
  }
  return crypto.timingSafeEqual(a, b)
}

/**
 * Validate Mercado Pago webhook signature.
 *
 * MP webhook signature format (as of 2025):
 *   Header: x-signature: ts=<unix_epoch>,v1=<hmac_sha256_hex>
 *   Header: x-request-id: <uuid>
 *
 * The signed string is built by CONCATENATING (no separators):
 *   {x-request-id}{ts}{body}
 *
 * When x-request-id is absent, only the body is used.
 */
export function validateMercadoPagoSignature(
  body: string,
  signatureHeader: string | null,
  xRequestId: string | null,
): boolean {
  if (!signatureHeader) {
    console.warn('[WebhookSignature] Missing x-signature header')
    return false
  }

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) {
    console.warn('[WebhookSignature] Could not parse x-signature header:', signatureHeader)
    return false
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.error('[WebhookSignature] MERCADOPAGO_WEBHOOK_SECRET is not configured')
    return false
  }

  // Build the signed string per MP spec:
  // With x-request-id:  xRequestId + ts + body  (concatenated, NO separator)
  // Without:            body only (legacy fallback)
  const signedString = xRequestId ? `${xRequestId}${parsed.ts}${body}` : body

  const expected = computeHmacSha256Hex(secret, signedString)

  try {
    const expectedBuf = Buffer.from(expected, 'hex')
    const receivedBuf = Buffer.from(parsed.v1, 'hex')

    if (expectedBuf.length !== receivedBuf.length) {
      console.warn(`[WebhookSignature] Signature length mismatch: expected=${expectedBuf.length} received=${receivedBuf.length}`)
      return false
    }

    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch (err) {
    console.warn('[WebhookSignature] Signature comparison failed:', err)
    return false
  }
}
