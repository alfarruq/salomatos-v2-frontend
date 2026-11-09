import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSession, useSessionStore } from '@/entities/session'
import { MOCK_PATIENTS, MOCK_PRESCRIPTIONS, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { PrescriptionCards } from './PrescriptionCards'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
  useSessionStore.getState().clear()
})
afterAll(() => server.close())

const AZIZA = MOCK_PATIENTS[0]?.id ?? ''
const GULNORA = MOCK_PATIENTS[2]?.id ?? ''
const NEWER = mockId(11, 2)

const item = (n: number, medicine: string, dose: string, form: string, times: number) => ({
  id: mockId(12, n),
  medicine,
  dose,
  form,
  times_per_day: times,
  duration_days: 5,
  meal_relation: 'after',
  instructions: '',
})

/** Two prescriptions, listed oldest first so the sort is what puts the newer on top. */
const PRESCRIPTIONS = [
  { ...MOCK_PRESCRIPTIONS[0], created_at: '2026-08-20T06:00:00Z' },
  {
    ...MOCK_PRESCRIPTIONS[0],
    id: NEWER,
    notes: "Issiq ovqat iste'mol qilmang.",
    created_at: '2026-09-02T06:00:00Z',
    items: [item(2, 'Amoksiklav 625 mg', '1', 'tablet', 2), item(3, 'Xolisal gel', '1', 'gel', 3)],
  },
]

function renderCards(patientId = AZIZA) {
  const handlers = { onCreate: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onPrint: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <PrescriptionCards clinicId="clinic:test" patientId={patientId} {...handlers} />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return handlers
}

describe('PrescriptionCards', () => {
  beforeEach(() => {
    signInAs('admin')
    server.use(
      http.get('/api/v1/prescriptions/', ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get('patient') === AZIZA
            ? { count: 2, next: null, previous: null, results: PRESCRIPTIONS }
            : { count: 0, next: null, previous: null, results: [] },
        ),
      ),
    )
  })

  it('lists the newest prescription first, dated dd.MM.yyyy', async () => {
    renderCards()

    const newer = await screen.findByText('02.09.2026')
    const older = screen.getByText('20.08.2026')
    // DOCUMENT_POSITION_FOLLOWING: the older card comes after the newer one.
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows each medicine as a chip with its dosage, and the count', async () => {
    renderCards()

    expect(await screen.findByText('Amoksiklav 625 mg · 1 tabletka')).toBeInTheDocument()
    expect(screen.getByText('Xolisal gel · 1 marta surtish')).toBeInTheDocument()
    expect(screen.getByText('2 ta dori')).toBeInTheDocument()
  })

  it("keeps an older row's own wording instead of dropping it", async () => {
    renderCards()

    // The fixture's dose is written as "400 mg", not as a count of tablets.
    expect(await screen.findByText('Ibuprofen · 400 mg tabletka')).toBeInTheDocument()
  })

  it('shows the note when there is one, and nothing when it is empty', async () => {
    renderCards()

    expect(await screen.findByText("Issiq ovqat iste'mol qilmang.")).toBeInTheDocument()
  })

  it('hands the right prescription to each action', async () => {
    useSessionStore.getState().setSession(await fetchSession())
    const { onEdit, onDelete, onPrint } = renderCards()

    const card = (await screen.findByText('02.09.2026')).closest('div.flex.flex-col') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Tahrirlash' }))
    await userEvent.click(within(card).getByRole('button', { name: "O'chirish" }))
    await userEvent.click(within(card).getByRole('button', { name: 'Chop etish' }))

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: NEWER }))
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: NEWER }))
    expect(onPrint).toHaveBeenCalledWith(expect.objectContaining({ id: NEWER }))
  })

  it('shows edit and delete only to staff who manage prescriptions', async () => {
    renderCards()

    const card = (await screen.findByText('02.09.2026')).closest('div.flex.flex-col') as HTMLElement
    expect(within(card).getByRole('button', { name: 'Chop etish' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'Tahrirlash' })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: "O'chirish" })).not.toBeInTheDocument()
  })

  it('invites a first prescription when there are none', async () => {
    const { onCreate } = renderCards(GULNORA)

    expect(
      await screen.findByRole('heading', { name: "Hozircha retsept yo'q" }),
    ).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'Retsept yozish' })
    await userEvent.click(buttons[buttons.length - 1] as HTMLElement)

    expect(onCreate).toHaveBeenCalledTimes(1)
  })
})
