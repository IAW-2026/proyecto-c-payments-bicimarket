import crypto from 'crypto'

export function validateServiceTokenBuyer(token: string | null) { 
  if (!token) return false
  const secret = process.env.BUYER_TO_PAYMENTS_SERVICE_TOKEN
  if (!secret) return false
  return token === secret
}

export function validateServiceTokenShipping(token: string | null) {
  if (!token) return false
  const secret = process.env.SHIPPING_TO_PAYMENTS_SERVICE_TOKEN
  if (!secret) return false
  return token === secret
}
