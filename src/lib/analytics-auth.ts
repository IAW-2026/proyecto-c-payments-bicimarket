import { validateServiceTokenAnalytics } from './service-token'
import { unauthorized } from './errors'

export function requireAnalyticsToken(req: Request): Response | null {
  const svcToken = req.headers.get('X-Service-Token') || req.headers.get('x-service-token')
  if (!validateServiceTokenAnalytics(svcToken)) {
    return unauthorized('Invalid or missing analytics service token', 'ANALYTICS_TOKEN_REQUIRED')
  }
  return null
}