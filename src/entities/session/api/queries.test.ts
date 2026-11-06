import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/errors'
import { configureApi, resetApiContext } from '@/shared/api/httpContext'
import { accessTokenFor, MOCK_CLINICS, MOCK_USERS } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { getTenantScope, setTenantScope } from '@/shared/api/tenantScope'
import { fetchSession } from './queries'

/**
 * Runs against the MSW handlers rather than a stubbed fetch, so the real
 * httpClient is exercised: the bearer header, the error envelope and the 401
 * hand-off all have to actually work.
 */
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetApiContext()
  signOut()
})
afterAll(() => server.close())

describe('fetchSession', () => {
  it('maps the wire shape to the domain shape', async () => {
    signInAs('admin')
    const session = await fetchSession()

    expect(session.userId).toBe(MOCK_USERS.admin.id)
    expect(session.fullName).toBe(MOCK_USERS.admin.full_name)
    expect(session.role).toBe('admin')
    expect(session.membershipId).toBe(MOCK_USERS.admin.memberships[0].id)
  })

  it('takes permissions from the membership, never from a role table', async () => {
    signInAs('admin')
    const admin = await fetchSession()
    signInAs('doctor')
    const doctor = await fetchSession()

    expect(admin.permissions.has('payment:manage')).toBe(true)
    expect(doctor.permissions.has('procedure:manage')).toBe(true)
    expect(doctor.permissions.has('payment:manage')).toBe(false)
  })

  it('falls back to the first branch when no scope was chosen', async () => {
    signInAs('owner')
    setTenantScope(null)
    const session = await fetchSession()

    expect(session.scope).toEqual({ kind: 'clinic', id: MOCK_CLINICS.main.id })
    // Every request after this one goes to the resolved branch.
    expect(getTenantScope()).toEqual(session.scope)
  })

  it("gives the owner's all-branches view read permissions only", async () => {
    signInAs('owner', 'all')
    const session = await fetchSession()

    expect(session.isAllBranches).toBe(true)
    expect(session.membershipId).toBeNull()
    expect(session.permissions.has('patient:view')).toBe(true)
    expect(session.permissions.has('patient:manage')).toBe(false)
  })

  it('refuses a user who belongs to no clinic', async () => {
    signInAs('orphan')

    await expect(fetchSession()).rejects.toMatchObject({ messageKey: 'no_clinic' })
  })

  it('fails loudly when the contract is broken', async () => {
    signInAs('admin')
    server.use(
      // `memberships` dropped by a serializer change. An app with every control
      // hidden would look like "this user may do nothing"; an error is honest.
      http.get('/api/v1/auth/me/', () => HttpResponse.json({ id: MOCK_USERS.admin.id })),
    )

    await expect(fetchSession()).rejects.toThrow()
  })
})

describe('when there is no usable token', () => {
  it('reports unauthorized without asking the server', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/auth/me/', () => {
        calls += 1
        return HttpResponse.json({})
      }),
    )

    await expect(fetchSession()).rejects.toBeInstanceOf(ApiError)
    expect(calls).toBe(0)
  })
})

describe('when the server rejects the token', () => {
  it('reports unauthorized and hands off exactly once', async () => {
    signInAs('admin')
    const onUnauthorized = vi.fn()
    configureApi({ onUnauthorized })
    server.use(
      http.get('/api/v1/auth/me/', () =>
        HttpResponse.json({ detail: 'Given token not valid for any token type' }, { status: 401 }),
      ),
    )

    await expect(fetchSession()).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })
})

describe('the bearer header', () => {
  it('carries the token on every request', async () => {
    const seen: (string | null)[] = []
    server.use(
      http.get('/api/v1/auth/me/', ({ request }) => {
        seen.push(request.headers.get('Authorization'))
        return HttpResponse.json({})
      }),
    )
    signInAs('admin')

    await fetchSession().catch(() => undefined)

    expect(seen).toEqual([`Bearer ${accessTokenFor('admin')}`])
  })
})
