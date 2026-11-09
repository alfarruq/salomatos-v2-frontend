import { isJwtExpired } from '@/shared/lib/jwt'
import { storage } from '@/shared/lib/storage'
import { clearAccessToken, setAccessToken } from './tokenStore'

/**
 * The session's persistence boundary (ADR `auth-session-storage`, revises
 * ADR-003). `tokenStore` is still the only thing the request layer reads from
 * — this only keeps it in step with the allowlisted storage wrapper so a
 * reload does not look like a sign-out.
 */

/**
 * Called once on app start, before the router is created, so the guard's
 * first `beforeLoad` sees a live token instead of bouncing to /login and back.
 */
export function restoreSession(): boolean {
  const token = storage.get('accessToken')
  if (token === null || isJwtExpired(token)) {
    clearAccessToken()
    storage.remove('accessToken')
    // A live refresh token still restores the session: the first request trades it (`refreshSession`).
    const refresh = storage.get('refreshToken')
    if (refresh === null || isJwtExpired(refresh, 0)) storage.remove('refreshToken')
    return false
  }
  setAccessToken(token)
  return true
}

export function saveSession(accessToken: string, refreshToken: string): void {
  setAccessToken(accessToken)
  storage.set('accessToken', accessToken)
  storage.set('refreshToken', refreshToken)
}

export function clearSession(): void {
  clearAccessToken()
  storage.remove('accessToken')
  storage.remove('refreshToken')
}
