import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { botAccessKeys, botAccessPath, fetchBotAccess } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const PATIENT = '550e8400-e29b-41d4-a716-446655440000'

describe('botAccessKeys', () => {
  it('puts the clinic inside every key and keeps targets apart', () => {
    const patient = botAccessKeys.detail('clinic:a', { kind: 'patient', id: PATIENT })
    expect(patient.slice(0, 2)).toEqual(['clinics', 'clinic:a'])
    expect(patient).not.toEqual(botAccessKeys.detail('clinic:b', { kind: 'patient', id: PATIENT }))
    expect(patient).not.toEqual(botAccessKeys.detail('clinic:a', { kind: 'staff', id: PATIENT }))
  })
})

describe('botAccessPath', () => {
  it('addresses patient, staff and own logins by id only', () => {
    expect(botAccessPath({ kind: 'patient', id: PATIENT })).toBe(
      `v1/patients/${PATIENT}/bot-access/`,
    )
    expect(botAccessPath({ kind: 'staff', id: PATIENT })).toBe(`v1/staff/${PATIENT}/bot-access/`)
    expect(botAccessPath({ kind: 'mine' })).toBe('v1/me/bot-access/')
  })
})

describe('fetchBotAccess', () => {
  beforeEach(() => signInAs('owner'))

  it('maps the wire shape', async () => {
    server.use(
      http.get(`/api/v1/patients/${PATIENT}/bot-access/`, () =>
        HttpResponse.json({ login: '12345678', password: 'k7m4q9rx', linked: true }),
      ),
    )

    await expect(fetchBotAccess({ kind: 'patient', id: PATIENT })).resolves.toEqual({
      login: '12345678',
      password: 'k7m4q9rx',
      isLinked: true,
    })
  })

  it('accepts a password the server can no longer read', async () => {
    server.use(
      http.get('/api/v1/me/bot-access/', () =>
        HttpResponse.json({ login: '12345678', password: null, linked: false }),
      ),
    )

    const access = await fetchBotAccess({ kind: 'mine' })
    expect(access.password).toBeNull()
  })
})
