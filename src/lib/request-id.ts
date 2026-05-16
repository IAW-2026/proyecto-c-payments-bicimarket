import crypto from 'crypto'

declare global {
  // eslint-disable-next-line no-var
  var __requestId__: string | undefined
}

export function generateRequestId(): string {
  return crypto.randomUUID()
}

export function extractRequestId(req: Request): string {
  const existing = req.headers.get('X-Request-Id') || req.headers.get('x-request-id')
  return existing || generateRequestId()
}

export function getRequestId(): string {
  return globalThis.__requestId__ || generateRequestId()
}

export function withRequestId(headers: Record<string, string>): Record<string, string> {
  if (!headers['X-Request-Id'] && !headers['x-request-id']) {
    headers['X-Request-Id'] = generateRequestId()
  }
  return headers
}
