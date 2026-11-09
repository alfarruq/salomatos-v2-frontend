/**
 * The one thing the HTTP client needs from the rest of the app, injected
 * rather than imported.
 *
 * The 401 handler has to clear state that lives in `entities/session`, and
 * `shared` may not import upwards (§3.3) — the boundaries linter rejects it.
 * Inverting the dependency keeps the rule intact and, usefully, makes the
 * client trivial to drive from a test.
 *
 * The access token is *not* here: it lives in `tokenStore`, one layer over, so
 * the request layer can read it without a round trip through the application.
 */

interface ApiContext {
  /**
   * Called once when the session is gone for good: the server refused the
   * token and the refresh token could not replace it. A hard logout: drop the
   * tokens, send the user to /login.
   */
  onUnauthorized: () => void
}

const noop: ApiContext = {
  onUnauthorized: () => {},
}

let context: ApiContext = noop

export function configureApi(next: Partial<ApiContext>): void {
  context = { ...context, ...next }
}

/** Restores the defaults. For tests. */
export function resetApiContext(): void {
  context = noop
}

export function getApiContext(): ApiContext {
  return context
}
