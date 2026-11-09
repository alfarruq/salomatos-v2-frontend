import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { saveSession } from '@/shared/api/authSession'
import { accessTokenFor } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signOut } from '@/shared/api/mocks/signIn'
import { getAccessToken } from '@/shared/api/tokenStore'
import { storage } from '@/shared/lib/storage'
import { useLogout } from './useLogout'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
}

describe('useLogout', () => {
  it('revokes the refresh token on the server, then forgets both tokens', async () => {
    saveSession(accessTokenFor('admin'), 'refresh-to-revoke')
    const revoked: unknown[] = []
    server.use(
      http.post('/api/v1/auth/logout/', async ({ request }) => {
        revoked.push(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )

    const { result } = renderHook(() => useLogout(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(revoked).toEqual([{ refresh_token: 'refresh-to-revoke' }])
    expect(getAccessToken()).toBeNull()
    expect(storage.get('refreshToken')).toBeNull()
  })

  it('still signs out locally when the server cannot be reached', async () => {
    saveSession(accessTokenFor('admin'), 'refresh-to-revoke')
    server.use(http.post('/api/v1/auth/logout/', () => HttpResponse.error()))

    const { result } = renderHook(() => useLogout(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(getAccessToken()).toBeNull()
    expect(storage.get('refreshToken')).toBeNull()
  })
})
