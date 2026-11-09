import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSessionStore } from '@/entities/session'
import { clearSession } from '@/shared/api/authSession'
import { httpClient } from '@/shared/api/httpClient'
import { storage } from '@/shared/lib/storage'

/**
 * Revokes the refresh token on the server, then forgets everything locally.
 *
 * The server call is best-effort: the user asked to leave, so a network error
 * must not keep them signed in on a shared reception machine. The access token
 * cannot be revoked and simply expires (minutes); the refresh token would
 * otherwise stay usable for days.
 */
async function signOut(): Promise<void> {
  const refreshToken = storage.get('refreshToken')
  if (refreshToken === null) return
  try {
    await httpClient<void>('v1/auth/logout/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch {
    // See above: leaving locally is what matters.
  }
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await signOut()
      clearSession()
    },
    retry: false,

    /*
     * `onSettled`, not `onSuccess`: the user asked to leave, and the next
     * member of staff at a shared reception desk must not find the previous
     * one's patients on screen (§13.4).
     */
    onSettled: () => {
      useSessionStore.getState().clear()
      // Not invalidate — that would refetch. Everything cached belongs to the
      // person who just left.
      queryClient.clear()
    },
  })
}
