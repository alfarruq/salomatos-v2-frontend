import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSession, useSessionStore } from '@/entities/session'
import { defaultTreatmentListFilters, type TreatmentListFilters } from '@/entities/treatment'
import { MOCK_PROCEDURES, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { PAGE_SIZE } from '@/shared/api/pagination'
import { createI18n } from '@/shared/i18n'
import { TreatmentTable } from './TreatmentTable'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
  useSessionStore.getState().clear()
})
afterAll(() => server.close())

const ROW = MOCK_PROCEDURES[0]
const AZIZA = mockId(7, 1)
const PROCEDURES = '/api/v1/procedures/'

const page = (results: unknown[], count = results.length, next: string | null = null) => ({
  count,
  next,
  previous: null,
  results,
})

/** `<Can>` and `useCan` read the store, so the session has to be in it. */
async function signIn() {
  signInAs('admin')
  useSessionStore.getState().setSession(await fetchSession())
}

function captureUrls(): URL[] {
  const seen: URL[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.url.includes(PROCEDURES)) seen.push(new URL(request.url))
  })
  return seen
}

function renderTable(overrides: Partial<TreatmentListFilters> = {}) {
  const onFiltersChange = vi.fn()
  const filters = { ...defaultTreatmentListFilters, ...overrides }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <TreatmentTable clinicId="clinic:test" filters={filters} onFiltersChange={onFiltersChange} />
    ),
  })
  const patientRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/patients/$patientId',
    component: () => <p>patient page</p>,
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

  return { onFiltersChange, router }
}

describe('TreatmentTable', () => {
  beforeEach(signIn)

  it('lists every procedure in the clinic, with the patient and the cost', async () => {
    renderTable()

    expect(await screen.findByRole('link', { name: 'Aziza Karimova' })).toBeInTheDocument()
    expect(screen.getByText('10.08.2026')).toBeInTheDocument()
    expect(screen.getByText('Plomba')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Davolash qiymati' })).toBeInTheDocument()
  })

  it('strikes through the cost of a voided procedure', async () => {
    server.use(
      http.get(PROCEDURES, () =>
        HttpResponse.json(
          page([
            { ...ROW, id: mockId(9, 1), service_name: 'Amalda' },
            {
              ...ROW,
              id: mockId(9, 2),
              service_name: 'Bekor',
              voided_at: '2026-08-11T06:00:00Z',
              void_reason: 'Xato',
            },
          ]),
        ),
      ),
    )
    renderTable()

    const kept = (await screen.findByText('Amalda')).closest('tr') as HTMLElement
    const voided = screen.getByText('Bekor').closest('tr') as HTMLElement
    expect(voided.querySelector('.line-through')).not.toBeNull()
    expect(kept.querySelector('.line-through')).toBeNull()
  })

  it('asks the server for the three pages of the screen it is on, with no patient filter', async () => {
    const seen = captureUrls()
    renderTable({ page: 2 })

    await vi.waitFor(() => expect(seen).toHaveLength(3))
    expect(seen.map((url) => url.searchParams.get('page')).sort()).toEqual(['4', '5', '6'])
    expect(seen.some((url) => url.searchParams.has('patient'))).toBe(false)
  })

  it("opens the patient's page from a row", async () => {
    const { router } = renderTable()

    await userEvent.click(await screen.findByText('Plomba'))

    expect(await screen.findByText('patient page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`/patients/${AZIZA}`)
  })

  it('grows the first screen one server page per "next", then moves to the next screen', async () => {
    server.use(
      http.get(PROCEDURES, ({ request }) => {
        const n = Number(new URL(request.url).searchParams.get('page'))
        return HttpResponse.json(
          page(
            Array.from({ length: 10 }, (_, index) => ({
              ...ROW,
              id: mockId(9, n * 100 + index),
              service_name: `Tur ${n}-${index}`,
            })),
            70,
            `https://salomatos.uz${PROCEDURES}?page=${n + 1}`,
          ),
        )
      }),
    )
    const { onFiltersChange } = renderTable()

    await screen.findByText('70 tadan 1–10')
    await userEvent.click(screen.getByRole('button', { name: 'Keyingi' }))
    await screen.findByText('70 tadan 1–20')
    expect(screen.getByText('Tur 1-0')).toBeInTheDocument()
    expect(screen.getByText('Tur 2-9')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Keyingi' }))
    await screen.findByText('70 tadan 1–30')
    expect(onFiltersChange).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Keyingi' }))
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }))
  })

  it('shows a later screen as three full server pages at once', async () => {
    server.use(
      http.get(PROCEDURES, ({ request }) => {
        const n = Number(new URL(request.url).searchParams.get('page'))
        return HttpResponse.json(
          page(
            Array.from({ length: PAGE_SIZE }, (_, index) => ({
              ...ROW,
              id: mockId(9, n * 100 + index),
            })),
            200,
            `https://salomatos.uz${PROCEDURES}?page=${n + 1}`,
          ),
        )
      }),
    )
    renderTable({ page: 2 })

    const from = 3 * PAGE_SIZE + 1
    const to = 6 * PAGE_SIZE
    expect(await screen.findByText(`200 tadan ${from}–${to}`)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Aziza Karimova' })).toHaveLength(3 * PAGE_SIZE)
  })

  it('shows a skeleton while loading', async () => {
    server.use(
      http.get(PROCEDURES, async () => {
        await delay('infinite')
        return HttpResponse.json(page([]))
      }),
    )
    renderTable()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('says so when there are no procedures', async () => {
    server.use(http.get(PROCEDURES, () => HttpResponse.json(page([]))))
    renderTable()

    expect(
      await screen.findByRole('heading', { name: "Hozircha muolaja yo'q" }),
    ).toBeInTheDocument()
  })

  it('offers a retry when the list cannot be loaded', async () => {
    server.use(http.get(PROCEDURES, () => HttpResponse.json({ message: 'boom' }, { status: 500 })))
    renderTable()

    expect(
      await screen.findByRole('heading', { name: 'Bu sahifa ochilmadi' }, { timeout: 8000 }),
    ).toBeInTheDocument()
  })

  it('sends every active filter to the server as ids', async () => {
    const seen = captureUrls()
    renderTable({
      patientId: AZIZA,
      doctorId: mockId(4, 4),
      treatmentTypeId: mockId(6, 1),
      status: 'voided',
    })

    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0))
    const params = seen[0]?.searchParams
    expect(params?.get('patient')).toBe(AZIZA)
    expect(params?.get('doctor')).toBe(mockId(4, 4))
    expect(params?.get('service')).toBe(mockId(6, 1))
    expect(params?.get('voided')).toBe('true')
  })

  it('maps "done" to voided=false', async () => {
    const seen = captureUrls()
    renderTable({ status: 'done' })

    await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0))
    expect(seen[0]?.searchParams.get('voided')).toBe('false')
  })

  it('filters by a status picked from the list, back on page 1', async () => {
    const { onFiltersChange } = renderTable({ page: 2 })

    await userEvent.click(await screen.findByRole('combobox', { name: "Holat bo'yicha filtr" }))
    await userEvent.click(await screen.findByRole('option', { name: 'Yaroqsiz' }))

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'voided', page: 1 }),
    )
  })

  it('filters by a doctor picked from the list, by id', async () => {
    const { onFiltersChange } = renderTable()

    await userEvent.click(await screen.findByRole('combobox', { name: "Shifokor bo'yicha filtr" }))
    await userEvent.click(await screen.findByRole('option', { name: 'Sardor Usmonov' }))

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: mockId(4, 4) }),
    )
  })

  it('finds a patient by name and filters by their id', async () => {
    const { onFiltersChange } = renderTable()

    await userEvent.type(await screen.findByRole('searchbox'), 'Aziza')
    await userEvent.click(await screen.findByRole('button', { name: /Aziza Karimova/ }))

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ patientId: AZIZA }))
  })

  it('shows the picked patient by name, and clears them', async () => {
    const { onFiltersChange } = renderTable({ patientId: AZIZA })

    // findByRole, not findByText: text matches even while Suspense still hides the tree.
    const clear = await screen.findByRole('button', { name: 'Bemor filtrini olib tashlash' })
    expect(await screen.findByText('Aziza Karimova', { selector: 'span' })).toBeInTheDocument()
    await userEvent.click(clear)

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ patientId: null }))
  })

  it('offers to clear the filters when nothing matches them', async () => {
    server.use(http.get(PROCEDURES, () => HttpResponse.json(page([]))))
    const { onFiltersChange } = renderTable({ status: 'voided' })

    expect(
      await screen.findByRole('heading', { name: 'Mos muolaja topilmadi' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Filtrlarni tozalash' }))

    expect(onFiltersChange).toHaveBeenCalledWith(defaultTreatmentListFilters)
  })
})
