import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/errors'
import { resetApiContext } from '@/shared/api/httpContext'
import { MOCK_PATIENTS, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { defaultPatientFilters } from '../model/types'
import { fetchPatient, fetchPatients, patientKeys } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetApiContext()
  signOut()
})
afterAll(() => server.close())

const AZIZA = MOCK_PATIENTS[0]?.id ?? ''

describe('patientKeys', () => {
  it('puts the tenant scope inside every key', () => {
    // 🔴 §6.2: without it, a branch switch would be served the previous branch's patients from memory.
    expect(patientKeys.scope('clinic:a')).toEqual(['clinics', 'clinic:a', 'patients'])
    expect(patientKeys.detail('clinic:a', AZIZA)).toEqual([
      'clinics',
      'clinic:a',
      'patients',
      'detail',
      AZIZA,
    ])
  })

  it('gives two branches different keys for the same patient', () => {
    expect(patientKeys.detail('clinic:a', AZIZA)).not.toEqual(patientKeys.detail('clinic:b', AZIZA))
  })
})

describe('fetchPatients', () => {
  beforeEach(() => signInAs('owner'))

  it('reads the page envelope and maps every row', async () => {
    const page = await fetchPatients(defaultPatientFilters)

    expect(page.count).toBe(3)
    expect(page.results[0]?.fullName).toBe('Aziza Karimova')
  })

  it('searches through a POST body, never the URL', async () => {
    const urls: string[] = []
    let body: unknown
    server.events.on('request:start', async ({ request }) => {
      urls.push(request.url)
      if (request.method === 'POST') body = await request.clone().json()
    })

    const page = await fetchPatients({ ...defaultPatientFilters, search: 'bekzod' })

    expect(page.results.map((patient) => patient.fullName)).toEqual(['Bekzod Aliyev'])
    // 🔴 §3: a patient's name in a URL ends up in access logs and browser history.
    expect(urls.join(' ')).not.toContain('bekzod')
    expect(body).toEqual({ query: 'bekzod', include_archived: false })
  })

  it('filters by primary doctor', async () => {
    const page = await fetchPatients({ ...defaultPatientFilters, doctorId: mockId(4, 5) })

    expect(page.results.map((patient) => patient.fullName)).toEqual(['Bekzod Aliyev'])
  })

  it('sends the branch header the server scopes by', async () => {
    let header: string | null = null
    server.events.on('request:start', ({ request }) => {
      header = request.headers.get('X-Clinic-Id')
    })

    await fetchPatients(defaultPatientFilters)

    expect(header).toBe(mockId(2, 1))
  })

  it('refuses to serve patients without a token', async () => {
    signOut()

    await expect(fetchPatients(defaultPatientFilters)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('fetchPatient', () => {
  beforeEach(() => signInAs('owner'))

  it('maps the detail response', async () => {
    const patient = await fetchPatient(AZIZA)

    expect(patient.fullName).toBe('Aziza Karimova')
    expect(patient.clinicName).toBe('Chilonzor')
  })

  it('answers 404 for a patient of another branch', async () => {
    signInAs('owner', 'second')

    await expect(fetchPatient(AZIZA)).rejects.toMatchObject({ kind: 'notFound' })
  })
})
