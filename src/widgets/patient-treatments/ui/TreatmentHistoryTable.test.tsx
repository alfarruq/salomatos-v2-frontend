import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSession, useSessionStore } from '@/entities/session'
import { MOCK_PATIENTS, MOCK_PROCEDURES, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { TreatmentHistoryTable } from './TreatmentHistoryTable'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
  useSessionStore.getState().clear()
})
afterAll(() => server.close())

const AZIZA = MOCK_PATIENTS[0]?.id ?? ''
const GULNORA = MOCK_PATIENTS[2]?.id ?? ''

function renderTable(patientId = AZIZA) {
  const onCreate = vi.fn()
  const onVoid = vi.fn()

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <TreatmentHistoryTable
            clinicId="clinic:test"
            onCreate={onCreate}
            onVoid={onVoid}
            patientId={patientId}
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { onCreate, onVoid }
}

describe('TreatmentHistoryTable', () => {
  beforeEach(async () => {
    signInAs('admin')
    // `<Can>` reads the store, which the app fills from this same request.
    useSessionStore.getState().setSession(await fetchSession())
  })

  it('renders the recorded procedures and the counts', async () => {
    renderTable()

    expect(await screen.findByText('Plomba')).toBeInTheDocument()
    expect(screen.getByText('Jami: 1')).toBeInTheDocument()
    expect(screen.getByText('Yaroqsiz: 0')).toBeInTheDocument()
  })

  it('shows an empty state with a call to action for a patient with no procedures', async () => {
    const { onCreate } = renderTable(GULNORA)

    expect(await screen.findByText("Muolajalar yo'q")).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: "Birinchi muolajani qo'shing" }))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('opens the detail dialog on a double-click on the tooth badge', async () => {
    renderTable()

    await userEvent.dblClick(await screen.findByRole('button', { name: '36' }))

    expect(await screen.findByRole('heading', { name: "Muolaja ma'lumotlari" })).toBeInTheDocument()
    expect(screen.getByText(/Tish: 36/)).toBeInTheDocument()
  })

  it('hands a recorded line to the void flow; never offers to edit it', async () => {
    const { onVoid } = renderTable()
    await screen.findByText('Plomba')

    await userEvent.click(screen.getByRole('button', { name: /Amallar — Plomba/ }))
    expect(screen.queryByRole('menuitem', { name: /Tahrirlash/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Yaroqsiz deb belgilash' }))

    expect(onVoid).toHaveBeenCalledWith(expect.objectContaining({ id: MOCK_PROCEDURES[0]?.id }))
  })

  it('strikes a voided line through and offers nothing more on it', async () => {
    server.use(
      http.get('/api/v1/procedures/', () =>
        HttpResponse.json({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              ...MOCK_PROCEDURES[0],
              id: mockId(9, 7),
              voided_at: '2026-08-11T06:00:00Z',
              void_reason: 'Xato',
            },
          ],
        }),
      ),
    )
    renderTable()

    const cost = await screen.findByText(/350.000/)
    expect(cost).toHaveClass('line-through')

    await userEvent.click(screen.getByRole('button', { name: /Amallar — Plomba/ }))
    expect(
      screen.queryByRole('menuitem', { name: 'Yaroqsiz deb belgilash' }),
    ).not.toBeInTheDocument()
  })
})
