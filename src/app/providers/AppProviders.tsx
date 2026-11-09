import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, Suspense, useEffect, useRef, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import { type Session, sessionKeys, useSessionStore } from '@/entities/session'
import { clearSession } from '@/shared/api/authSession'
import { configureApi } from '@/shared/api/httpContext'
import { createI18n } from '@/shared/i18n'
import { Toaster } from '@/shared/ui'
import { createQueryClient } from './queryClient'

/**
 * Wires the pieces that have to know about each other exactly once.
 *
 * The HTTP client is told how to find the active clinic and what to do about a
 * 401 here, rather than importing that itself — `shared` may not reach up into
 * `entities` (§3.3), and injecting it keeps the client testable.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // One client for the app's lifetime; recreating it on render would empty the
  // cache on every state change.
  const [queryClient] = useState(createQueryClient)
  // Also once: recreating it would drop every loaded namespace.
  const [i18n] = useState(() => createI18n())
  const isConfigured = useRef(false)

  if (!isConfigured.current) {
    configureApi({
      onUnauthorized: () => {
        /*
         * Reached only after `httpClient` failed to refresh the token, so the
         * session really is over.
         *
         * The token goes first: anything still in flight should stop being
         * sent as an authenticated request. `clearSession` drops it from
         * storage too (ADR `auth-session-storage`), not just from memory.
         *
         * The *query cache* is deliberately not cleared here. Doing so in
         * response to a 401 would cancel the request that reported it, and the
         * guard would see a CancelledError rather than `unauthorized` and show
         * an error screen instead of the login form. The cache is emptied on
         * arrival at /login, which is where the user ends up either way and
         * where nothing is in flight (§13.4).
         */
        clearSession()
        useSessionStore.getState().clear()
      },
    })
    isConfigured.current = true
  }

  /*
   * Keeps the store in step with the query cache. The query is the source of
   * truth; the store exists so non-React code (the HTTP client) and narrow
   * selectors can read the session without subscribing to a query.
   */
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryHash !== JSON.stringify(sessionKeys.me())) return
      // The query function returns a parsed Session, so this narrowing is a
      // fact about sessionQueries.me() rather than an assumption.
      const data = event.query.state.data as Session | undefined
      useSessionStore.getState().setSession(data ?? null)
    })
  }, [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        {/*
         * Namespaces load on demand (§12.1), so the first render of a screen
         * may suspend. `null` rather than a spinner: it resolves in a frame
         * from a local chunk, and a flash of loader would be worse than
         * nothing.
         */}
        <Suspense fallback={null}>{children}</Suspense>
        <Toaster />
      </I18nextProvider>
    </QueryClientProvider>
  )
}
