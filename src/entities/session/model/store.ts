import { create } from 'zustand'
import type { Permission, Session } from './types'

/**
 * The session, in memory and nowhere else.
 *
 * ⛔ No `persist` middleware. §13.2 and ADR-007: the reception desk computer is
 * shared, and anything written to browser storage survives logout for the next
 * member of staff — or for a browser extension — to read.
 *
 * Unlike the original design, losing this on refresh is not recoverable: the
 * access token lives in memory too (`shared/api/tokenStore`) and the backend
 * returns tokens in a response body rather than an httpOnly cookie, so there
 * is nothing left to restore the session from. A reload signs the user out.
 */
interface SessionState {
  session: Session | null
  /**
   * The name this user signed in with.
   *
   * Kept here rather than on `Session` because it does not come from the
   * server — `UserMeSerializer` omits `username` along with `id` — so putting
   * it on the parsed wire type would misrepresent where it came from. The
   * sign-in form records it; the lock screen needs it to re-authenticate,
   * since the login endpoint takes a username and there is no other way to
   * recover one.
   *
   * Always present whenever `session` is: the token lives in memory only, so a
   * session can only exist if this page-life performed the sign-in.
   */
  username: string | null
  setSession: (session: Session | null) => void
  setUsername: (username: string | null) => void
  clear: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  username: null,

  setSession: (session) => set({ session }),

  setUsername: (username) => set({ username }),

  clear: () => set({ session: null, username: null }),
}))

/**
 * Frontend permission check — for hiding controls the user cannot use, nothing
 * more. §9.1: real authorisation is the server's.
 *
 * ⚠️ On this backend it is not even a reflection of the server's rules, because
 * the server has none beyond "is anyone logged in". See ADR-012.
 */
export function useCan(permission: Permission): boolean {
  return useSessionStore((state) => state.session?.permissions.has(permission) ?? false)
}

/**
 * The caller's own doctor id when they may only act as themselves — a doctor
 * without `permission` (e.g. `appointment:view_all`) — else null. Doctor
 * pickers use it to offer that one doctor, preselected, instead of a list the
 * server would refuse every other entry of. UX only, like `useCan`.
 */
export function useActsOnlyAs(permission: Permission): string | null {
  return useSessionStore((state) => {
    const session = state.session
    if (session === null || session.permissions.has(permission)) return null
    return session.membershipId
  })
}
