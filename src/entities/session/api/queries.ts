import { queryOptions, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/shared/api/errors'
import { httpClient } from '@/shared/api/httpClient'
import { getTenantScope, setTenantScope } from '@/shared/api/tenantScope'
import { getAccessToken } from '@/shared/api/tokenStore'
import { cachePolicy } from '@/shared/config/cache'
import { parseSession } from '../model/sessionSchema'
import type { Session } from '../model/types'

/**
 * The one query key with no `clinicId` in it, and the reason the rule holds
 * everywhere else: this response is what *tells* the app which tenant is
 * active. Scoping it by tenant would be circular (§6.2).
 */
export const sessionKeys = {
  root: () => ['session'] as const,
  me: () => [...sessionKeys.root(), 'me'] as const,
}

export async function fetchSession(signal?: AbortSignal): Promise<Session> {
  // No token is the ordinary signed-out case; skip the round trip that would 401.
  if (getAccessToken() === null) {
    throw new ApiError({ kind: 'unauthorized', messageKey: 'no_access_token' })
  }

  const raw = await httpClient<unknown>('v1/auth/me/', signal === undefined ? {} : { signal })
  // Parsed, not cast: a serializer change should fail loudly here.
  const session = parseSession(raw, getTenantScope())
  if (session === null) {
    // Signed in, but a member of no active clinic: nothing in the app is reachable.
    throw new ApiError({ kind: 'forbidden', messageKey: 'no_clinic' })
  }
  // Every request after this one goes to the resolved tenant.
  setTenantScope(session.scope)
  return session
}

export const sessionQueries = {
  me: () =>
    queryOptions({
      queryKey: sessionKeys.me(),
      queryFn: ({ signal }) => fetchSession(signal),
      ...cachePolicy.standard,
      // A 401 means signed out. Retrying cannot change that, and each attempt
      // delays the redirect to /login.
      retry: false,
    }),
}

/**
 * The session as React should read it: from the query, not the store.
 *
 * The store exists for narrow selectors — `useCan` subscribes to one
 * permission rather than the whole session — and is kept in step by a provider
 * effect. Returns undefined only before the guard has resolved; inside `_auth`
 * it is always present.
 */
export function useSession(): Session | undefined {
  return useQuery(sessionQueries.me()).data
}
