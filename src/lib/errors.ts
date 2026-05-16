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

export function badRequest(message: string, details?: Record<string, unknown>) {
  return errorResponse('BAD_REQUEST', message, 400, details)
}

export function unauthorized(message = 'Unauthorized') {
  return errorResponse('UNAUTHORIZED', message, 401)
}

export function forbidden(message = 'Forbidden') {
  return errorResponse('FORBIDDEN', message, 403)
}

export function notFound(message = 'Resource not found', details?: Record<string, unknown>) {
  return errorResponse('NOT_FOUND', message, 404, details)
}

export function conflict(message: string, details?: Record<string, unknown>) {
  return errorResponse('CONFLICT', message, 409, details)
}

export function unprocessable(message: string, details?: Record<string, unknown>) {
  return errorResponse('UNPROCESSABLE_ENTITY', message, 422, details)
}

export function internalError(message = 'Internal server error') {
  return errorResponse('INTERNAL_ERROR', message, 500)
}

export function handleRouteError(err: unknown, context: string) {
  console.error(`Error ${context}:`, err)

  if (err instanceof InvalidTransitionError) {
    return conflict('INVALID_TRANSITION', {
      entity: err.entity,
      from: err.from,
      to: err.to,
    })
  }

  if (err instanceof SyntaxError) {
    return badRequest('Invalid JSON payload')
  }

  return internalError()
}
