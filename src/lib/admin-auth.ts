import { auth, currentUser } from '@clerk/nextjs/server'
import { unauthorized, forbidden } from './errors'

export async function requireAdmin() {
  const session = await auth()
  const userId = session?.userId

  if (!userId) {
    return unauthorized('Authentication required', 'AUTH_REQUIRED')
  }

  const claims = session?.sessionClaims as Record<string, unknown> | undefined
  const claimMetadata = claims?.publicMetadata as Record<string, unknown> | undefined

  if (claimMetadata?.admin === true) return null

  try {
    const user = await currentUser()
    const userMetadata = user?.publicMetadata as Record<string, unknown> | undefined
    if (userMetadata?.admin === true) return null
  } catch (err) {
    console.error('[requireAdmin] currentUser() failed:', err)
  }

  return forbidden('Admin access required', 'ADMIN_REQUIRED')
}
