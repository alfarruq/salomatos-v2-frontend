import ky from 'ky'
import * as v from 'valibot'
import { storage } from '@/shared/lib/storage'
import { saveSession } from './authSession'

const tokenPairSchema = v.object({
  result: v.object({
    access_token: v.pipe(v.string(), v.minLength(1)),
    refresh_token: v.pipe(v.string(), v.minLength(1)),
  }),
})

let inflight: Promise<boolean> | null = null

/**
 * Trades the stored refresh token for a new pair. Single-flight: the backend
 * rotates and blacklists the refresh token on use, so a second concurrent call
 * with the same token would be refused and sign the user out.
 */
export function refreshSession(): Promise<boolean> {
  inflight ??= exchange().finally(() => {
    inflight = null
  })
  return inflight
}

async function exchange(): Promise<boolean> {
  const refreshToken = storage.get('refreshToken')
  // Expiry is the server's call: it answers 401 and the caller signs out.
  if (refreshToken === null) return false
  try {
    // Plain ky, not `api`: the shared client's 401 hook would call back in here.
    const raw: unknown = await ky
      .post(`${globalThis.location.origin}/api/v1/auth/refresh/`, {
        json: { refresh_token: refreshToken },
        retry: 0,
        timeout: 20_000,
      })
      .json()
    const { result } = v.parse(tokenPairSchema, raw)
    saveSession(result.access_token, result.refresh_token)
    return true
  } catch {
    return false
  }
}
