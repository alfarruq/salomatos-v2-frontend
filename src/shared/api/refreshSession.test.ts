import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { storage } from '@/shared/lib/storage'
import { clearSession } from './authSession'
import { httpClient } from './httpClient'
import { configureApi, resetApiContext } from './httpContext'
import { accessTokenFor } from './mocks/fixtures'
import { server } from './mocks/server'
import { signInAs, signOut } from './mocks/signIn'
import { getAccessToken, setAccessToken } from './tokenStore'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetApiContext()
  signOut()
  clearSession()
})
afterAll(() => server.close())

const EXPIRED = 'expired.access.token'

/** `me/` refuses the expired token and accepts any other, like the server after a refresh. */
function meRejectsExpired(seen: (string | null)[] = []) {
  server.use(
    http.get('/api/v1/auth/me/', ({ request }) => {
      const auth = request.headers.get('Authorization')
      seen.push(auth)
      if (auth === `Bearer ${EXPIRED}`) return HttpResponse.json({}, { status: 401 })
      return HttpResponse.json({ ok: true })
    }),
  )
}

describe('an expired access token', () => {
  it('is traded for a new pair and the request repeated with it', async () => {
    signInAs('admin')
    setAccessToken(EXPIRED)
    storage.set('refreshToken', accessTokenFor('admin'))
    const onUnauthorized = vi.fn()
    configureApi({ onUnauthorized })
    const seen: (string | null)[] = []
    meRejectsExpired(seen)

    await expect(httpClient('v1/auth/me/')).resolves.toEqual({ ok: true })
    expect(seen).toEqual([`Bearer ${EXPIRED}`, `Bearer ${accessTokenFor('admin')}`])
    expect(getAccessToken()).toBe(accessTokenFor('admin'))
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('is refreshed once for requests that fail together', async () => {
    signInAs('admin')
    setAccessToken(EXPIRED)
    storage.set('refreshToken', accessTokenFor('admin'))
    meRejectsExpired()
    let refreshes = 0
    server.use(
      http.post('/api/v1/auth/refresh/', () => {
        refreshes += 1
        return HttpResponse.json({
          result: { access_token: accessTokenFor('admin'), refresh_token: accessTokenFor('admin') },
        })
      }),
    )

    await Promise.all([
      httpClient('v1/auth/me/'),
      httpClient('v1/auth/me/'),
      httpClient('v1/auth/me/'),
    ])
    // The backend blacklists a refresh token on use: a second exchange would fail.
    expect(refreshes).toBe(1)
  })

  it('signs out exactly once when the refresh token is refused too', async () => {
    signInAs('admin')
    setAccessToken(EXPIRED)
    storage.set('refreshToken', 'revoked')
    const onUnauthorized = vi.fn()
    configureApi({ onUnauthorized })
    meRejectsExpired()

    await expect(httpClient('v1/auth/me/')).rejects.toMatchObject({ kind: 'unauthorized' })
    await Promise.resolve()
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})
