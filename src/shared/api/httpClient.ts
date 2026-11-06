import ky, { HTTPError, TimeoutError } from 'ky'
import { ApiError, normalizeDrfError } from './errors'
import { getApiContext } from './httpContext'
import { getTenantScope } from './tenantScope'
import { getAccessToken } from './tokenStore'

/*
 * §1.2 — the API is same-origin behind nginx, so the origin is read from the
 * page rather than configured. There is no environment variable that could
 * point this at another host and reintroduce CORS and cross-site cookies.
 * ky 2 parses the prefix as a URL and rejects a bare `/api`.
 */
const API_PREFIX = `${globalThis.location.origin}/api`

export const api = ky.create({
  prefix: API_PREFIX,
  timeout: 20_000,

  retry: {
    limit: 2,
    // GET only. Retrying a POST could book the same appointment twice.
    methods: ['get'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },

  // ky 2 hands each hook a state object; §5.2's snippet predates that.
  hooks: {
    beforeRequest: [
      ({ request }) => {
        /*
         * Bearer token, no cookie, so Django's CSRF middleware does not apply.
         * The tenant header names the clinic (or, for owners, the organization)
         * the request is for; the backend checks it against the membership.
         */
        const token = getAccessToken()
        if (token !== null) request.headers.set('Authorization', `Bearer ${token}`)
        const scope = getTenantScope()
        if (scope?.kind === 'clinic') request.headers.set('X-Clinic-Id', scope.id)
        if (scope?.kind === 'organization') request.headers.set('X-Organization-Id', scope.id)
      },
    ],

    afterResponse: [
      ({ response }) => {
        /*
         * A 401 is terminal. The backend exposes no token refresh route, so
         * there is nothing to retry with — the `refresh_token` it issues at
         * login has nowhere to be sent. Hand off once and let the error surface.
         *
         * Deferred to a microtask so application code never runs inside this
         * request's own promise chain. A handler that touched the query cache
         * would otherwise cancel the very request that triggered it, and the
         * caller would receive a CancelledError instead of the `unauthorized`
         * ApiError the route guard branches on.
         */
        if (response.status === 401) {
          queueMicrotask(() => {
            getApiContext().onUnauthorized()
          })
        }
        return response
      },
    ],
  },
})

/**
 * Every request goes through here, so the UI only ever sees `ApiError`.
 */
export async function httpClient<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await api(url, options as never)
    // 204 and friends have no body; asking for JSON would throw.
    if (response.status === 204) return undefined as T
    return await response.json<T>()
  } catch (error) {
    throw toApiError(error)
  }
}

/**
 * A binary response (an X-ray, a prescription PDF). Private files have no
 * public URL: they stream through authenticated endpoints, so an `<img src>`
 * cannot load them and the bytes are fetched with the token instead.
 */
export async function httpBlob(url: string, options?: RequestInit): Promise<Blob> {
  try {
    const response = await api(url, options as never)
    return await response.blob()
  } catch (error) {
    throw toApiError(error)
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof HTTPError) {
    /*
     * `error.data`, not `error.response.json()`. ky 2 pre-parses the body and
     * consumes the response doing so, so reading it again yields nothing —
     * which silently emptied every field error and left users with "something
     * went wrong" instead of the message the server sent (§10).
     */
    return normalizeDrfError({
      status: error.response.status,
      body: error.data,
      requestId: error.response.headers.get('X-Request-Id') ?? undefined,
    })
  }

  if (error instanceof TimeoutError) {
    return new ApiError({ kind: 'network', message: 'timeout' })
  }

  if (error instanceof ApiError) return error

  // Offline, DNS failure, a request the browser refused to make.
  return new ApiError({ kind: 'network', message: 'network_error' })
}
