import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http, type JsonBodyType } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSession, useSessionStore } from '@/entities/session'
import { mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { DashboardToday } from './DashboardToday'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
  useSessionStore.getState().clear()
  vi.useRealTimers()
})
afterAll(() => server.close())

/** 10:00 in Tashkent (UTC+5) on 2026-10-09. */
const NOW = new Date('2026-10-09T05:00:00Z')
const TODAY = '2026-10-09'

const SARDOR = mockId(4, 4)
const NODIRA = mockId(4, 5)

/** `time` is Tashkent wall clock; the server sends UTC, five hours earlier. */
const row = (
  n: number,
  time: string,
  name: string,
  status: 'scheduled' | 'completed',
  doctor = SARDOR,
  date = TODAY,
) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const start = new Date(`${date}T00:00:00Z`)
  start.setUTCHours(hours - 5, minutes)
  return {
    id: mockId(8, n),
    clinic_name: 'Chilonzor',
    patient: mockId(7, n),
    patient_name: name,
    doctor,
    doctor_name: doctor === SARDOR ? 'Sardor Usmonov' : 'Nodira Karimova',
    chair: null,
    service: null,
    start_at: start.toISOString(),
    end_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
    status,
    notes: '',
  }
}

const DAY = [
  row(1, '09:00', 'Vali Aliyev', 'completed'),
  row(3, '11:00', 'Yangi Mijoz', 'scheduled'),
  row(2, '10:30', 'Gulnora Yusupova', 'scheduled'),
  // Yesterday's row the server should not have sent — it must not be counted.
  row(4, '12:00', 'Kecha', 'scheduled', SARDOR, '2026-10-08'),
]

const page = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
})

function serve(body: JsonBodyType) {
  server.use(http.get('/api/v1/appointments/', () => HttpResponse.json(body)))
}

function renderDashboard(doctorId: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <DashboardToday clinicId="clinic:test" doctorId={doctorId} />,
  })
  const patientRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/patients/$patientId',
    component: function PatientStub() {
      const { patientId } = patientRoute.useParams()
      return <p>patient page {patientId}</p>
    },
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, patientRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { router }
}

describe('DashboardToday', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    signInAs('admin')
    // `<Can>` reads the store, which the app fills from this same request.
    useSessionStore.getState().setSession(await fetchSession())
  })

  it('shows a skeleton while the day loads', async () => {
    server.use(
      http.get('/api/v1/appointments/', async () => {
        await delay('infinite')
        return HttpResponse.json([])
      }),
    )
    renderDashboard()

    expect(await screen.findByRole('heading', { name: 'Bugungi navbat' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Bugungi navbat' })).not.toBeInTheDocument()
  })

  it('lists today in time order and counts from that same list', async () => {
    serve(page(DAY))
    renderDashboard()

    const list = await screen.findByRole('list', { name: 'Bugungi navbat' })
    const names = within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    expect(names[0]).toContain('Vali Aliyev')
    expect(names[1]).toContain('Gulnora Yusupova')
    expect(names[2]).toContain('Yangi Mijoz')
    expect(screen.queryByText('Kecha')).not.toBeInTheDocument()

    const counters = screen.getByText('Jami qabullar').closest('dl') as HTMLElement
    expect(within(counters).getByText('3')).toBeInTheDocument()
    expect(within(counters).getByText('1')).toBeInTheDocument()
    expect(within(counters).getByText('2')).toBeInTheDocument()
  })

  it('highlights the next open appointment, not the completed or past one', async () => {
    serve(page(DAY))
    renderDashboard()

    const next = (await screen.findByText('Navbatdagi')).closest('[data-next]') as HTMLElement
    expect(next).toHaveTextContent('Gulnora Yusupova')
    expect(next).toHaveTextContent('10:30')
  })

  it("opens the patient's page from a row", async () => {
    serve(page(DAY))
    const { router } = renderDashboard()

    await userEvent.click(await screen.findByRole('link', { name: /Gulnora Yusupova/ }))

    expect(await screen.findByText(`patient page ${mockId(7, 2)}`)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/patients/${mockId(7, 2)}`)
  })

  it("narrows to one doctor's queue", async () => {
    serve(page([...DAY, row(5, '13:00', 'Boshqa shifokor bemori', 'scheduled', NODIRA)]))
    renderDashboard(NODIRA)

    const list = await screen.findByRole('list', { name: 'Bugungi navbat' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(list).toHaveTextContent('Boshqa shifokor bemori')
  })

  it('offers to book when nobody is booked today', async () => {
    serve(page([]))
    renderDashboard()

    expect(await screen.findByRole('heading', { name: "Bugun qabul yo'q" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Qabul qo'shish" })).toBeInTheDocument()
  })

  it('says so when the day cannot be loaded', async () => {
    server.use(
      http.get('/api/v1/appointments/', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderDashboard()

    expect(
      await screen.findByRole('heading', { name: 'Bu sahifa ochilmadi' }, { timeout: 8000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Qayta urinish' })).toBeInTheDocument()
  })
})
