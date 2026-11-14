import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/errors'
import { MOCK_SPECIALTIES } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { doctorTypeKeys, fetchDoctorTypes } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

describe('doctorTypeKeys', () => {
  it('puts the tenant scope inside every key', () => {
    expect(doctorTypeKeys.list('clinic:a')).toEqual(['clinics', 'clinic:a', 'doctor-types', 'list'])
    expect(doctorTypeKeys.list('clinic:a')).not.toEqual(doctorTypeKeys.list('clinic:b'))
  })
})

describe('fetchDoctorTypes', () => {
  beforeEach(() => signInAs('owner'))

  it("reads the branch's specialties", async () => {
    const types = await fetchDoctorTypes()

    expect(types).toEqual([
      { id: MOCK_SPECIALTIES[0]?.id, name: 'Stomatolog', isDental: true },
      { id: MOCK_SPECIALTIES[1]?.id, name: 'Ortodont', isDental: false },
    ])
  })

  it('refuses a row with no name, which nothing could render', async () => {
    server.use(
      http.get('/api/v1/specialties/', () => HttpResponse.json([{ id: MOCK_SPECIALTIES[0]?.id }])),
    )

    await expect(fetchDoctorTypes()).rejects.toThrow()
  })

  it('refuses a page envelope, which the backend does not send for this list', async () => {
    server.use(
      http.get('/api/v1/specialties/', () =>
        HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
      ),
    )

    await expect(fetchDoctorTypes()).rejects.toThrow()
  })

  it('needs a token', async () => {
    signOut()

    await expect(fetchDoctorTypes()).rejects.toBeInstanceOf(ApiError)
  })
})
