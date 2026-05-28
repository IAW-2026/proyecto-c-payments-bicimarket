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

function computeHmacSha256Hex(key: string | Buffer, data: string): string {
  return crypto
    .createHmac('sha256', key)
    .update(data, 'utf8')
    .digest('hex')
}

function buildSignatureManifest(dataId: string, xRequestId: string, ts: string): string {
  return `id:${dataId};request-id:${xRequestId};ts:${ts};`
}

function normalizeMercadoPagoDataId(dataId: string): string {
  return /[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId
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

  if (!dataId) {
    console.warn('[WebhookSignature] Missing data id for signature validation')
    return false
  }

  const manifest = buildSignatureManifest(normalizeMercadoPagoDataId(dataId), xRequestId ?? '', parsed.ts)
  const expectedSignature = computeHmacSha256Hex(secret, manifest)

  if (constantTimeEqualsHex(expectedSignature, parsed.v1)) {
    console.info('[WebhookSignature] Signature match')
    return true
  }

  console.warn(
    `[WebhookSignature] Signature mismatch dataId=${dataId} xRequestId=${xRequestId ?? ''} ts=${parsed.ts}`
  )
  return false
}
