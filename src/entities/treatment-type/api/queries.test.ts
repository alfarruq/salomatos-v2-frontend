import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MOCK_SERVICES, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { toTreatmentTypePayload } from '../model/formSchema'
import { fetchTreatmentTypes, treatmentTypeKeys } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

describe('treatmentTypeKeys', () => {
  it('puts the tenant scope inside every key', () => {
    expect(treatmentTypeKeys.list('clinic:a')).toEqual([
      'clinics',
      'clinic:a',
      'treatment-types',
      'list',
    ])
    expect(treatmentTypeKeys.list('clinic:a')).not.toEqual(treatmentTypeKeys.list('clinic:b'))
  })
})

describe('fetchTreatmentTypes', () => {
  beforeEach(() => signInAs('owner'))

  it('reads the price list, with money parsed from decimal strings', async () => {
    const services = await fetchTreatmentTypes()

    expect(services).toHaveLength(3)
    expect(services[0]).toEqual({
      id: MOCK_SERVICES[0]?.id,
      code: 'T01',
      name: 'Plomba',
      price: 350_000,
      doctorTypeId: mockId(5, 1),
      durationMinutes: 45,
      isActive: true,
    })
  })

  it('follows `next` until it is null, rather than stopping at page one', async () => {
    const row = (n: number) => ({ id: mockId(6, 90 + n), name: `Service ${n}`, price: '1000.00' })
    server.use(
      http.get('/api/v1/services/', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')
        return HttpResponse.json(
          page === '2'
            ? { count: 2, next: null, previous: '/api/v1/services/', results: [row(2)] }
            : { count: 2, next: '/api/v1/services/?page=2', previous: null, results: [row(1)] },
        )
      }),
    )

    const services = await fetchTreatmentTypes()

    expect(services.map((service) => service.name)).toEqual(['Service 1', 'Service 2'])
  })
})

describe('toTreatmentTypePayload', () => {
  it('sends the price as the decimal string DRF expects and the specialty as an id', () => {
    expect(
      toTreatmentTypePayload({ name: 'Plomba', price: '350000', doctorTypeId: mockId(5, 1) }),
    ).toEqual({ name: 'Plomba', price: '350000', specialty: mockId(5, 1) })
  })

  it('sends no specialty as null', () => {
    expect(
      toTreatmentTypePayload({ name: 'Plomba', price: '1', doctorTypeId: '' }).specialty,
    ).toBeNull()
  })
})
