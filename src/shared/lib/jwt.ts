/**
 * Reads the payload of a JWT access token.
 *
 * ⚠️ **This does not verify anything.** The signature is not checked and cannot
 * be — the key lives on the server. Everything returned here is attacker-
 * controlled in principle, so it may only be used for things that are already
 * the client's own business: which cache bucket to put a response in, which
 * tenant header to send. Django re-derives the user from the token on every
 * request and is the only thing that decides what may be read or written.
 *
 * It exists because `/api/me/` returns neither the user's id nor their clinic
 * (see `UserMeSerializer`), and query keys have to be scoped by tenant (§6.2).
 * The token already carries `user_id` — simplejwt puts it there and the
 * backend's own `CustomJwtAuthentication` reads exactly that claim — so this
 * avoids asking for a serializer change to learn something we were already
 * handed.
 */

export interface JwtPayload {
  /**
   * simplejwt's `USER_ID_CLAIM`. Doubles as the tenant id: in this backend a
   * clinic *is* a user row (`User.clinic` points at a `superadmin` account),
   * so a clinic login's own id is the scope its data hangs off.
   */
  /** simplejwt's `user_id` claim: the user's UUID. */
  userId: string
}

function decodePayloadSegment(segment: string): unknown {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  // base64url drops the padding that atob insists on.
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  // atob yields one char per byte; the payload is UTF-8, and a non-ASCII name
  // in a claim would otherwise come back mojibake.
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

/**
 * Returns null for anything that is not a readable token, rather than throwing.
 * A malformed token is a signed-out user, which is a state the app already
 * handles — not a crash.
 */
export function readJwtPayload(token: string): JwtPayload | null {
  const segments = token.split('.')
  const payload = segments[1]
  if (segments.length !== 3 || payload === undefined) return null

  let decoded: unknown
  try {
    decoded = decodePayloadSegment(payload)
  } catch {
    return null
  }

  if (typeof decoded !== 'object' || decoded === null) return null

  /*
   * A number *or* a numeric string.
   *
   * simplejwt writes the claim as `user_id = getattr(user, USER_ID_FIELD)` and
   * only stringifies it when it is not an int — but which of the two arrives
   * depends on the version and on how the pk is declared, and getting it wrong
   * meant the session could not be built at all. Accepting both costs nothing
   * and removes a failure mode that looked, from the login form, like a wrong
   * password.
   *
   * Still strict about the value: it has to be a whole number. `"3.5"` and
   * `"abc"` are rejected rather than coerced into a cache key.
   */
  const claim = (decoded as Record<string, unknown>)['user_id']
  if (typeof claim !== 'string' || claim.trim() === '') return null

  return { userId: claim }
}

/**
 * UX-only expiry check for a token pulled back out of storage
 * (`shared/api/authSession.ts`) — the signature is not verified here, and
 * cannot be; the backend is what actually rejects an expired token. This only
 * decides whether it is worth sending at all, to skip a request that would
 * just 401.
 *
 * Returns true (expired) for anything unreadable, same as `readJwtPayload`
 * returning null: a token this client cannot make sense of is not one it
 * should hand to the router as a live session.
 */
export function isJwtExpired(token: string, skewSec = 30): boolean {
  const segments = token.split('.')
  const payload = segments[1]
  if (segments.length !== 3 || payload === undefined) return true

  let decoded: unknown
  try {
    decoded = decodePayloadSegment(payload)
  } catch {
    return true
  }

  if (typeof decoded !== 'object' || decoded === null) return true

  const exp = (decoded as Record<string, unknown>)['exp']
  if (typeof exp !== 'number') return true

  return exp * 1000 <= Date.now() + skewSec * 1000
}
