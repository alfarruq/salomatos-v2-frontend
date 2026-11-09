/**
 * The access token as the request layer reads it.
 *
 * `authSession` keeps it in step with the allowlisted storage wrapper (ADR
 * `auth-session-storage`), so a reload does not sign the user out. An expired
 * token is traded for a new pair through `auth/refresh/` (`refreshSession`).
 *
 * A plain variable rather than a store: nothing renders from it. React reads
 * the session from the query cache; this is only for the request layer.
 */

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function clearAccessToken(): void {
  accessToken = null
}
