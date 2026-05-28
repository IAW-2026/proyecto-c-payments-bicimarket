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

  const rawKeyExpected = computeHmacSha256Hex(secret, signedString)

  let hexKeyBuf: Buffer | undefined
  try { hexKeyBuf = Buffer.from(secret, 'hex') } catch {}
  const hexKeyExpected = hexKeyBuf && hexKeyBuf.length > 0
    ? computeHmacSha256Hex(hexKeyBuf, signedString)
    : null

  if (rawKeyExpected === parsed.v1) return true
  if (hexKeyExpected === parsed.v1) {
    console.info('[WebhookSignature] Match with hex-decoded key')
    return true
  }

  console.warn(
    `[WebhookSignature] MISMATCH manifest="${signedString}" ` +
    `raw_key_expected=${rawKeyExpected} ` +
    `hex_key_expected=${hexKeyExpected} ` +
    `received=${parsed.v1} dataId=${dataId} xRequestId=${xRequestId}`
  )
  return false
}
