function validateServiceToken(token: string | null, secretEnvVar: string): boolean {
  if (!token) return false
  const secret = process.env[secretEnvVar]
  if (!secret) {
    console.error(`Service token env var ${secretEnvVar} is not configured`)
    return false
  }
  return token === secret
}

export function validateServiceTokenBuyer(token: string | null) {
  return validateServiceToken(token, 'BUYER_TO_PAYMENTS_SERVICE_TOKEN')
}

export function validateServiceTokenShipping(token: string | null) {
  return validateServiceToken(token, 'SHIPPING_TO_PAYMENTS_SERVICE_TOKEN')
}

export function validateServiceTokenSeller(token: string | null) {
  return validateServiceToken(token, 'SELLER_TO_PAYMENTS_SERVICE_TOKEN')
}

export function validateServiceTokenPaymentsToBuyer(token: string | null) {
  return validateServiceToken(token, 'PAYMENTS_TO_BUYER_SERVICE_TOKEN')
}

export function validateServiceTokenPaymentsToSeller(token: string | null) {
  return validateServiceToken(token, 'PAYMENTS_TO_SELLER_SERVICE_TOKEN')
}
