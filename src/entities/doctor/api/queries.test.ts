import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/errors'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { doctorKeys, fetchDoctors } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

describe('doctorKeys', () => {
  it('puts the tenant scope inside every key', () => {
    expect(doctorKeys.list('clinic:a')).toEqual(['clinics', 'clinic:a', 'doctors', 'list'])
    expect(doctorKeys.list('clinic:a')).not.toEqual(doctorKeys.list('clinic:b'))
  })
})

describe('fetchDoctors', () => {
  beforeEach(() => signInAs('owner'))

  it('lists only the doctors among the staff', async () => {
    const doctors = await fetchDoctors()

    expect(doctors.map((doctor) => doctor.fullName)).toEqual(['Sardor Usmonov', 'Nodira Karimova'])
    expect(doctors[0]?.doctorTypeName).toBe('Stomatolog')
  })

  it('follows the pagination to the last page', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/staff/', ({ request }) => {
        calls += 1
        const page = new URL(request.url).searchParams.get('page')
        const row = (n: number) => ({
          id: `00000000-0000-4000-8099-00000000000${n}`,
          full_name: `Doctor ${n}`,
          role: 'doctor',
        })
        return HttpResponse.json(
          page === '2'
            ? { count: 2, next: null, previous: '/api/v1/staff/', results: [row(2)] }
            : { count: 2, next: '/api/v1/staff/?page=2', previous: null, results: [row(1)] },
        )
      }),
    )

    const doctors = await fetchDoctors()

    expect(calls).toBe(2)
    expect(doctors.map((doctor) => doctor.fullName)).toEqual(['Doctor 1', 'Doctor 2'])
  })

  it('refuses without a token', async () => {
    signOut()

    await expect(fetchDoctors()).rejects.toBeInstanceOf(ApiError)
  })
})
