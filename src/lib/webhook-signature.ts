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

function computeHmacSha256(secret: string, data: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(data, 'utf8')
    .digest('hex')
}

export function validateMercadoPagoSignature(
  body: string,
  signatureHeader: string | null,
  xRequestId: string | null,
): boolean {
  if (!signatureHeader) return false

  const parsed = parseSignatureHeader(signatureHeader)
  if (!parsed) return false

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.error('MERCADOPAGO_WEBHOOK_SECRET is not configured')
    return false
  }

  // Enhanced validation with x-request-id if present
  if (xRequestId) {
    const signedString = `${xRequestId},${parsed.ts},${body}`
    const expected = computeHmacSha256(secret, signedString)
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.v1))
  }

  // Fallback: body-only validation (standard MP webhooks without x-request-id)
  const expected = computeHmacSha256(secret, body)
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parsed.v1))
}
