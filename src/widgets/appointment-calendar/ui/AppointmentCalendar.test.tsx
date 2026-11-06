import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppointmentFilters } from '@/entities/appointment'
import { mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { AppointmentCalendar } from './AppointmentCalendar'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const SARDOR = mockId(4, 4)
const NODIRA = mockId(4, 5)

/** `time` is Tashkent wall clock; the server sends UTC, five hours earlier. */
function row(n: number, date: string, time: string, name: string, doctor = SARDOR) {
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
    status: 'scheduled',
    notes: '',
  }
}

const ROWS = [
  row(1, '2026-09-27', '09:00', 'Vali Aliyev'),
  row(2, '2026-09-27', '11:00', 'Gulnora Yusupova', NODIRA),
  row(3, '2026-09-29', '10:00', 'Bekzod Aliyev'),
  row(4, '2026-10-02', '10:00', 'Hafta Oxiri'),
]

// Answers the way the server does: by the start range and the doctor.
function serveRows() {
  server.use(
    http.get('/api/v1/appointments/', ({ request }) => {
      const params = new URL(request.url).searchParams
      const from = params.get('start_from')
      const to = params.get('start_to')
      const doctor = params.get('doctor')
      const results = ROWS.filter(
        (r) =>
          (from === null || r.start_at >= new Date(from).toISOString()) &&
          (to === null || r.start_at < new Date(to).toISOString()) &&
          (doctor === null || r.doctor === doctor),
      )
      return HttpResponse.json({ count: results.length, next: null, previous: null, results })
    }),
  )
}

function renderCalendar(
  filters: AppointmentFilters,
  onFiltersChange = vi.fn(),
  onOpenPatient = vi.fn(),
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <AppointmentCalendar
            clinicId="clinic:test"
            filters={filters}
            onFiltersChange={onFiltersChange}
            onOpenPatient={onOpenPatient}
            onPageChange={vi.fn()}
            page={1}
            title={null}
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return { onFiltersChange, onOpenPatient }
}

describe('AppointmentCalendar', () => {
  beforeEach(() => {
    signInAs('admin')
    serveRows()
  })

  it("shows the day's appointments only", async () => {
    renderCalendar({ view: 'day', date: '2026-09-27' })

    await screen.findByText('Vali Aliyev')
    expect(screen.getByText('Gulnora Yusupova')).toBeInTheDocument()
    expect(screen.queryByText('Bekzod Aliyev')).not.toBeInTheDocument()
  })

  it("opens the patient's card from their appointment", async () => {
    const onOpenPatient = vi.fn()
    renderCalendar({ view: 'day', date: '2026-09-27' }, vi.fn(), onOpenPatient)

    await userEvent.click(await screen.findByText('Vali Aliyev'))

    expect(onOpenPatient).toHaveBeenCalledWith(mockId(7, 1))
  })

  it('opens the picked date as a day view from the week view', async () => {
    const { onFiltersChange } = renderCalendar({ view: 'week', date: '2026-09-27' })

    fireEvent.change(await screen.findByLabelText('Sana'), { target: { value: '2026-10-05' } })

    expect(onFiltersChange).toHaveBeenLastCalledWith({ view: 'day', date: '2026-10-05' })
  })

  it('does not show a date column in day view', async () => {
    renderCalendar({ view: 'day', date: '2026-09-27' })
    await screen.findByText('Vali Aliyev')
    expect(screen.queryByText('Sana')).not.toBeInTheDocument()
  })

  it('groups the week into day columns by each appointment’s own date', async () => {
    // 2026-09-28 is a Monday, so the board runs through 2026-10-04.
    renderCalendar({ view: 'week', date: '2026-09-28' })

    await screen.findByText('Bekzod Aliyev')
    expect(screen.getByText('Hafta Oxiri')).toBeInTheDocument()
    expect(screen.queryByText('Vali Aliyev')).not.toBeInTheDocument()
    expect(screen.getByText('Se')).toBeInTheDocument()
    expect(screen.getByText('Ju')).toBeInTheDocument()
  })

  it('asks to move a day forward through onFiltersChange', async () => {
    const { onFiltersChange } = renderCalendar({ view: 'day', date: '2026-09-27' })
    await screen.findByText('Vali Aliyev')

    await userEvent.click(screen.getByRole('button', { name: 'Keyingi kun' }))

    expect(onFiltersChange).toHaveBeenLastCalledWith({ view: 'day', date: '2026-09-28' })
  })

  it('shows the empty state when the day has nothing scheduled', async () => {
    renderCalendar({ view: 'day', date: '2026-01-01' })

    expect(await screen.findByText("Hozircha uchrashuv yo'q")).toBeInTheDocument()
  })

  it('moves a week forward from the arrow beside the weekday row', async () => {
    const { onFiltersChange } = renderCalendar({ view: 'week', date: '2026-09-28' })

    await userEvent.click(await screen.findByRole('button', { name: 'Keyingi hafta' }))

    expect(onFiltersChange).toHaveBeenLastCalledWith({ view: 'week', date: '2026-10-05' })
  })

  it('narrows the list to one doctor by id', async () => {
    renderCalendar({ view: 'day', date: '2026-09-27', doctorId: NODIRA })

    await screen.findByText('Gulnora Yusupova')
    expect(screen.queryByText('Vali Aliyev')).not.toBeInTheDocument()
  })

  it('picks a doctor through onFiltersChange, keeping the view', async () => {
    const { onFiltersChange } = renderCalendar({ view: 'day', date: '2026-09-27' })
    await screen.findByText('Vali Aliyev')

    await userEvent.click(screen.getByRole('combobox', { name: 'Shifokor' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Sardor Usmonov' }))

    expect(onFiltersChange).toHaveBeenLastCalledWith({
      view: 'day',
      date: '2026-09-27',
      doctorId: SARDOR,
    })
  })

  it('keeps the picked doctor when switching view', async () => {
    const { onFiltersChange } = renderCalendar({
      view: 'day',
      date: '2026-09-27',
      doctorId: SARDOR,
    })
    await screen.findByText('Vali Aliyev')

    await userEvent.click(screen.getByRole('button', { name: 'Haftalik' }))

    expect(onFiltersChange).toHaveBeenLastCalledWith({
      view: 'week',
      date: expect.any(String),
      doctorId: SARDOR,
    })
  })

  it('shows the date column and every row in the all view', async () => {
    renderCalendar({ view: 'all', date: '2026-09-27' })

    await screen.findByText('Vali Aliyev')
    expect(screen.getByText('Sana')).toBeInTheDocument()
    expect(screen.getByText('Hafta Oxiri')).toBeInTheDocument()
  })
})
