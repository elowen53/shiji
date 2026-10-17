import { isAuthError, isAuthRetryableFetchError, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { OWNER_EMAIL } from './auth'

export type AccessStatus = 'allowed' | 'denied' | 'error'

/** A rejected access token needs one refresh, even if the device thinks it is still valid. */
export async function verifySessionAccess(client: SupabaseClient, session: Session): Promise<AccessStatus> {
  if (session.user.email !== OWNER_EMAIL) return 'denied'
  try {
    const initial = await client.rpc('shiji_has_access')
    if (!initial.error) return initial.data === true ? 'allowed' : 'denied'
    if (initial.status !== 401) return 'error'

    const refreshed = await client.auth.refreshSession()
    if (refreshed.error) {
      // Keep the saved login on network failures, throttling and server outages.
      return isAuthError(refreshed.error) && !isAuthRetryableFetchError(refreshed.error)
        && [400, 401, 403].includes(refreshed.error.status ?? 0) ? 'denied' : 'error'
    }
    if (!refreshed.data.session || refreshed.data.session.user.email !== OWNER_EMAIL) return 'denied'

    // A refreshed JWT alone is not authorization: the server must still confirm the owner session.
    const checked = await client.rpc('shiji_has_access')
    if (checked.error) return checked.status === 401 ? 'denied' : 'error'
    return checked.data === true ? 'allowed' : 'denied'
  } catch {
    return 'error'
  }
}
