import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/errors'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { clinicKeys, fetchClinic } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

describe('clinicKeys', () => {
  it('puts the tenant scope inside every key', () => {
    expect(clinicKeys.mine('clinic:a')).toEqual(['clinics', 'clinic:a', 'profile', 'mine'])
    expect(clinicKeys.mine('clinic:a')).not.toEqual(clinicKeys.mine('clinic:b'))
  })
})

describe('fetchClinic', () => {
  beforeEach(() => signInAs('owner'))

  it('reads the branch the header picks', async () => {
    expect((await fetchClinic()).name).toBe('Chilonzor')

    signInAs('owner', 'second')
    expect((await fetchClinic()).name).toBe('Yunusobod')
  })

  it('needs a token', async () => {
    signOut()

    await expect(fetchClinic()).rejects.toBeInstanceOf(ApiError)
  })
})
