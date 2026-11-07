import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MOCK_PATIENTS, MOCK_USERS, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { rangeOf } from '@/shared/lib/report'
import { fetchStatsOverview, statsKeys } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

describe('statsKeys', () => {
  it('puts the clinic inside every key', () => {
    const range = rangeOf('week', '2026-10-19')
    expect(statsKeys.overview('clinic:a', range, null)).toEqual([
      'clinics',
      'clinic:a',
      'stats',
      'overview',
      range,
      { doctorId: null },
    ])
    expect(statsKeys.overview('clinic:a', range, null)).not.toEqual(
      statsKeys.overview('clinic:b', range, null),
    )
    // One doctor's figures are cached apart from everyone's.
    expect(statsKeys.overview('clinic:a', range, 'doctor:a')).not.toEqual(
      statsKeys.overview('clinic:a', range, null),
    )
  })
})

describe('fetchStatsOverview', () => {
  // The seed: three patients registered 1–3 Aug, a filling on tooth 36 on 10 Aug,
  // a visit booked for Monday 24 Aug at 10:00 clinic time.
  const august = { from: '2026-08-01', to: '2026-08-31', bucket: 'day' as const }

  beforeEach(() => signInAs('owner'))

  it('reads counts with the tooth as an FDI string', async () => {
    const overview = await fetchStatsOverview(august, null)

    expect(overview.totals).toMatchObject({
      appointments: 1,
      appointmentsCompleted: 0,
      newPatients: MOCK_PATIENTS.length,
      returningPatients: 0,
      treatmentsCompleted: 1,
    })
    expect(overview.previousTotals.appointments).toBe(0)
    expect(overview.busySlots).toEqual([{ weekday: 1, hour: 10, appointments: 1 }])
    expect(overview.teeth).toEqual([{ tooth: '36', count: 1 }])
    expect(overview.treatmentTypes[0]).toMatchObject({ treatmentTypeName: 'Plomba', count: 1 })
  })

  it('carries no patient data', async () => {
    const overview = JSON.stringify(await fetchStatsOverview(august, null))

    for (const patient of MOCK_PATIENTS) {
      expect(overview).not.toContain(patient.full_name)
      expect(overview).not.toContain(patient.id)
    }
  })

  it('is refused to the front desk', async () => {
    signInAs('admin')
    await expect(fetchStatsOverview(august, null)).rejects.toMatchObject({ kind: 'forbidden' })
  })

  it('gives a doctor their own figures, whoever they ask for', async () => {
    signInAs('doctor')
    const mine = await fetchStatsOverview(august, null)
    expect(mine.doctors.map((row) => row.doctorId)).toEqual([MOCK_USERS.doctor.memberships[0].id])
    const asked = await fetchStatsOverview(august, mockId(4, 99))
    expect(asked.totals).toEqual(mine.totals)
  })
})
