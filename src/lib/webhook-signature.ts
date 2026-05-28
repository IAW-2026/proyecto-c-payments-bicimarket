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

export function validateMercadoPagoSignature(
  signatureHeader: string | null,
  xRequestId: string | null,
  dataId: string | null,
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
  
  // Per MP docs code examples, the manifest ALWAYS includes all three segments.
  // If a value is absent, its segment is included with an empty value.
  const idValue = dataId && /^[a-zA-Z0-9]+$/.test(dataId) ? dataId.toLowerCase() : (dataId ?? '')
  const signedString = `id:${idValue};request-id:${xRequestId ?? ''};ts:${parsed.ts};`

  const expected = computeHmacSha256Hex(secret, signedString)

  try {
    const expectedBuf = Buffer.from(expected, 'hex')
    const receivedBuf = Buffer.from(parsed.v1, 'hex')

    if (expectedBuf.length !== receivedBuf.length) {
      console.warn(`[WebhookSignature] Signature length mismatch: expected=${expectedBuf.length} received=${receivedBuf.length}`)
      console.warn(`[WebhookSignature] expected_hex=${expected} received_hex=${parsed.v1}`)
      return false
    }

    const match = timingSafeEqual(expectedBuf, receivedBuf)
    if (!match) {
      console.warn(`[WebhookSignature] Signature mismatch`)
      console.warn(`[WebhookSignature] manifest=${signedString}`)
      console.warn(`[WebhookSignature] expected_hex=${expected}`)
      console.warn(`[WebhookSignature] received_hex=${parsed.v1}`)
    }
    return match
  } catch (err) {
    console.warn('[WebhookSignature] Signature comparison failed:', err)
    return false
  }
}
