import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { fetchSession, type Session, sessionKeys, useSessionStore } from '@/entities/session'
import { clearSession, saveSession } from '@/shared/api/authSession'
import { httpClient } from '@/shared/api/httpClient'
import type { LoginInput } from './schema'

/**
 * `UserService.login` wraps its payload in the project's default response
 * serializer, so the tokens arrive one level down under `result`.
 *
 * `refresh_token` is read and persisted (ADR `auth-session-storage`) even
 * though the backend has no route to exchange it yet — it is there for when
 * one exists, and `saveSession` is what puts it in storage.
 */
const loginResponseSchema = v.object({
  result: v.object({
    access_token: v.pipe(v.string(), v.minLength(1)),
    refresh_token: v.pipe(v.string(), v.minLength(1)),
  }),
})

async function login(input: LoginInput): Promise<Session> {
  const raw = await httpClient<unknown>('v1/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: input.username, password: input.password }),
  })

  const { result } = v.parse(loginResponseSchema, raw)
  saveSession(result.access_token, result.refresh_token)

  try {
    /*
     * A second request, because the login response contains only tokens — no
     * user at all. `fetchSession` is also what reads the user id out of the
     * token, so going through it keeps one definition of what a session is.
     */
    return await fetchSession()
  } catch (error) {
    // Signed in as far as the server is concerned, but the app has no usable
    // session. Holding the token would leave the UI in a state where it looks
    // logged out yet sends authenticated requests.
    clearSession()
    throw error
  }
}

export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: login,
    // retry is already false globally (§6.4); repeating a failed sign-in would
    // walk the user into a rate limit.

    onSuccess: (session, input) => {
      queryClient.setQueryData(sessionKeys.me(), session)
      // The lock screen re-authenticates and the server wants a username;
      // this is the only moment one is available. See the store's comment.
      useSessionStore.getState().setUsername(input.username)
    },
  })
}
