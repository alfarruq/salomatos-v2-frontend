import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MOCK_PROCEDURES, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { defaultTreatmentListFilters } from '../model/types'
import { fetchTreatmentPage, fetchTreatments, treatmentKeys } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const AZIZA = mockId(7, 1)

describe('treatmentKeys', () => {
  it('puts the tenant scope inside every key', () => {
    expect(treatmentKeys.list('clinic:a', AZIZA)).toEqual([
      'clinics',
      'clinic:a',
      'treatments',
      'list',
      AZIZA,
    ])
  })
})

describe('fetchTreatments', () => {
  beforeEach(() => signInAs('owner'))

  it("reads one patient's procedures with money parsed from decimal strings", async () => {
    const rows = await fetchTreatments(AZIZA)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: MOCK_PROCEDURES[0]?.id,
      patientName: 'Aziza Karimova',
      treatmentTypeName: 'Plomba',
      toothNumber: 36,
      surfaces: ['O'],
      unitPrice: 350_000,
      totalTreatmentCost: 350_000,
      startDate: '2026-08-10',
      status: 'done',
    })
  })

  it('finds nothing for a patient with no procedures', async () => {
    expect(await fetchTreatments(mockId(7, 3))).toEqual([])
  })
})

describe('fetchTreatmentPage', () => {
  beforeEach(() => signInAs('owner'))

  it('filters the journal down to voided rows', async () => {
    const page = await fetchTreatmentPage({ ...defaultTreatmentListFilters, status: 'voided' })

    expect(page.count).toBe(0)
  })
})
