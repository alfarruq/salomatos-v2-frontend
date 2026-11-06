import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { fetchSession, type Session, sessionKeys } from '@/entities/session'
import { clearSession, saveSession } from '@/shared/api/authSession'
import { httpClient } from '@/shared/api/httpClient'
import { useLockStore } from './lockStore'

/**
 * Re-authenticates against the same endpoint the login form uses.
 *
 * Deliberately not imported from `features/auth-login`: two slices in the same
 * layer cannot see each other (§4), and they compose only one layer up. The
 * duplication is a few lines and the alternative is a dependency the linter
 * would reject.
 *
 * Re-authenticating rather than merely checking a password also issues a fresh
 * token, which is the safer outcome for a screen that was left unattended.
 */
const loginResponseSchema = v.object({
  result: v.object({
    access_token: v.pipe(v.string(), v.minLength(1)),
    refresh_token: v.pipe(v.string(), v.minLength(1)),
  }),
})

async function unlockRequest(input: { username: string; password: string }): Promise<Session> {
  const raw = await httpClient<unknown>('v1/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const { result } = v.parse(loginResponseSchema, raw)
  saveSession(result.access_token, result.refresh_token)

  try {
    return await fetchSession()
  } catch (error) {
    clearSession()
    throw error
  }
}

export function useUnlock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: unlockRequest,
    onSuccess: (session) => {
      queryClient.setQueryData(sessionKeys.me(), session)
      useLockStore.getState().unlock()
    },
  })
}
