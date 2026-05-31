import { NextResponse } from 'next/server'
import { InvalidTransitionError } from './state-machines/payment'

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

export function errorResponse(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, details } } satisfies ApiError, { status })
}

export function badRequest(codeOrMessage: string, messageOrDetails?: string | Record<string, unknown>, details?: Record<string, unknown>) {
  if (typeof messageOrDetails === 'string') {
    return errorResponse(codeOrMessage, messageOrDetails, 400, details)
  }
  return errorResponse('BAD_REQUEST', codeOrMessage, 400, messageOrDetails as Record<string, unknown> | undefined)
}

export function unauthorized(message?: string, code?: string) {
  return errorResponse(code || 'UNAUTHORIZED', message || 'Unauthorized', 401)
}

export function forbidden(message?: string, code?: string) {
  return errorResponse(code || 'FORBIDDEN', message || 'Forbidden', 403)
}

export function notFound(codeOrMessage: string, messageOrDetails?: string | Record<string, unknown>, details?: Record<string, unknown>) {
  if (typeof messageOrDetails === 'string') {
    return errorResponse(codeOrMessage, messageOrDetails, 404, details)
  }
  return errorResponse('NOT_FOUND', codeOrMessage, 404, messageOrDetails as Record<string, unknown> | undefined)
}

export function conflict(codeOrMessage: string, messageOrDetails?: string | Record<string, unknown>, details?: Record<string, unknown>) {
  if (typeof messageOrDetails === 'string') {
    return errorResponse(codeOrMessage, messageOrDetails, 409, details)
  }
  return errorResponse('CONFLICT', codeOrMessage, 409, messageOrDetails as Record<string, unknown> | undefined)
}

export function unprocessable(codeOrMessage: string, messageOrDetails?: string | Record<string, unknown>, details?: Record<string, unknown>) {
  if (typeof messageOrDetails === 'string') {
    return errorResponse(codeOrMessage, messageOrDetails, 422, details)
  }
  return errorResponse('UNPROCESSABLE_ENTITY', codeOrMessage, 422, messageOrDetails as Record<string, unknown> | undefined)
}

export function internalError(message?: string, code?: string) {
  return errorResponse(code || 'INTERNAL_ERROR', message || 'Internal server error', 500)
}

export function handleRouteError(err: unknown, context: string) {
  console.error(`Error ${context}:`, err)

  if (err instanceof InvalidTransitionError) {
    return conflict('INVALID_TRANSITION', 'Invalid payment state transition', {
      entity: err.entity,
      from: err.from,
      to: err.to,
    })
  }

  if (err instanceof SyntaxError) {
    return badRequest('INVALID_JSON', 'Invalid JSON payload')
  }

  return internalError()
}
