import { HttpResponse, http } from 'msw'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MOCK_APPOINTMENTS, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { fetchAppointmentPage, fetchAppointments } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

describe('fetchAppointments', () => {
  beforeEach(() => signInAs('owner'))

  it('maps instants to the clinic day and time', async () => {
    const appointments = await fetchAppointments({ view: 'day', date: '2026-08-24' })

    expect(appointments).toHaveLength(1)
    expect(appointments[0]).toMatchObject({
      id: MOCK_APPOINTMENTS[0]?.id,
      fullName: 'Aziza Karimova',
      doctorName: 'Sardor Usmonov',
      // 05:00 UTC is 10:00 in Tashkent.
      date: '2026-08-24',
      time: '10:00',
      durationMinutes: 45,
      status: 'scheduled',
    })
  })

  it('asks for the day as a range of instants on the clinic clock', async () => {
    let url: URL | undefined
    server.events.on('request:start', ({ request }) => {
      url = new URL(request.url)
    })

    await fetchAppointments({ view: 'day', date: '2026-08-24', doctorId: mockId(4, 4) })

    expect(url?.searchParams.get('start_from')).toBe('2026-08-23T19:00:00.000Z')
    expect(url?.searchParams.get('start_to')).toBe('2026-08-24T19:00:00.000Z')
    expect(url?.searchParams.get('doctor')).toBe(mockId(4, 4))
  })

  it('covers a whole week in one request', async () => {
    const appointments = await fetchAppointments({ view: 'week', date: '2026-08-26' })

    expect(appointments).toHaveLength(1)
  })

  it('finds nothing on a day with no visits', async () => {
    expect(await fetchAppointments({ view: 'day', date: '2026-08-25' })).toEqual([])
  })

  it('follows `next` so a busy day loses no appointment', async () => {
    const row = (n: number) => ({
      ...MOCK_APPOINTMENTS[0],
      id: mockId(8, 90 + n),
    })
    server.use(
      http.get('/api/v1/appointments/', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')
        return HttpResponse.json(
          page === '2'
            ? { count: 2, next: null, previous: null, results: [row(2)] }
            : { count: 2, next: '/api/v1/appointments/?page=2', previous: null, results: [row(1)] },
        )
      }),
    )

    const appointments = await fetchAppointments({ view: 'day', date: '2026-08-24' })

    expect(appointments.map((appointment) => appointment.id)).toEqual([
      mockId(8, 91),
      mockId(8, 92),
    ])
  })
})

describe('fetchAppointmentPage', () => {
  beforeEach(() => signInAs('owner'))

  it('reads one page of every appointment', async () => {
    const page = await fetchAppointmentPage({ view: 'all', date: '2026-08-24' }, 1)

    expect(page.count).toBe(1)
    expect(page.results[0]?.fullName).toBe('Aziza Karimova')
  })
})
