import { auth } from '@clerk/nextjs/server'
import { unauthorized, forbidden } from './errors'

export async function requireAdmin() {
  const session = await auth()
  const userId = session?.userId

  if (!userId) {
    return unauthorized('Authentication required')
  }

  const claims = session?.sessionClaims as Record<string, unknown> | undefined
  const publicMetadata = claims?.publicMetadata as Record<string, unknown> | undefined
  const isAdmin = publicMetadata?.admin === true

  if (!isAdmin) {
    return forbidden('Admin access required')
  }

  return null
}
