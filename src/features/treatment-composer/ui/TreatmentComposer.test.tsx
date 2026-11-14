import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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
import { TreatmentComposer } from './TreatmentComposer'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const AZIZA = MOCK_PATIENTS[0]?.id ?? ''

function renderComposer(props: { patientId?: string } = { patientId: AZIZA }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          {props.patientId === undefined ? (
            <TreatmentComposer clinicId="clinic:test" onOpenChange={vi.fn()} open />
          ) : (
            <TreatmentComposer
              clinicId="clinic:test"
              onOpenChange={vi.fn()}
              open
              patientId={props.patientId}
            />
          )}
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

async function chooseDoctor(name: RegExp) {
  await userEvent.click(
    await screen.findByRole('combobox', { name: 'Shifokor' }, { timeout: 5000 }),
  )
  await userEvent.click(await screen.findByRole('option', { name }))
}

async function addService(name: string) {
  await userEvent.click(screen.getByRole('combobox', { name: "Davolash turini qo'shish" }))
  await userEvent.click(await screen.findByRole('option', { name }))
}

describe('TreatmentComposer', () => {
  beforeEach(() => signInAs('owner'))

  it('waits for a doctor before offering any service', async () => {
    renderComposer()

    expect(
      await screen.findByRole('combobox', { name: 'Shifokor' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Tish 16/ })).not.toBeInTheDocument()
  })

  it("offers the doctor's specialty and the general services, not another specialty's", async () => {
    renderComposer()
    await chooseDoctor(/Nodira Karimova/)

    await userEvent.click(screen.getByRole('combobox', { name: "Davolash turini qo'shish" }))

    expect(await screen.findByRole('option', { name: 'Tozalash' })).toBeInTheDocument()
    // "Plomba" is filed under the therapist's specialty.
    expect(screen.queryByRole('option', { name: 'Plomba' })).not.toBeInTheDocument()
  })

  it("starts a row at the price list's figure", async () => {
    renderComposer()
    await chooseDoctor(/Sardor Usmonov/)
    await addService('Plomba')

    expect(screen.getByRole('button', { name: "O'chirish — Plomba" })).toBeInTheDocument()
    expect(screen.getByLabelText('Narx')).toHaveValue('350,000')
  })

  it('clears unsaved rows when the doctor switches to another specialty', async () => {
    renderComposer()
    await chooseDoctor(/Sardor Usmonov/)
    await addService('Tozalash')

    await chooseDoctor(/Nodira Karimova/)

    expect(screen.queryByRole('button', { name: "O'chirish — Tozalash" })).not.toBeInTheDocument()
  })

  it('records one procedure per row, with the price and paid amount', async () => {
    const posted: unknown[] = []
    server.use(
      http.post('/api/v1/procedures/', async ({ request }) => {
        posted.push(await request.json())
        return HttpResponse.json(MOCK_PROCEDURES[0], { status: 201 })
      }),
    )
    renderComposer()
    await chooseDoctor(/Sardor Usmonov/)
    await addService('Tozalash')
    await userEvent.click(screen.getByRole('checkbox', { name: "To'liq to'landi" }))

    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      patient: AZIZA,
      doctor: mockId(4, 4),
      service: mockId(6, 2),
      tooth: null,
      unit_price: '200000',
      paid_amount: '200000',
      status: 'completed',
      notes: '',
    })
  })

  it('has no doctor select for a doctor, who can only record their own work', async () => {
    signInAs('doctor')
    useSessionStore.getState().setSession(await fetchSession())
    renderComposer()

    await screen.findByRole('combobox', { name: "Davolash turini qo'shish" }, { timeout: 5000 })

    expect(screen.queryByRole('combobox', { name: 'Shifokor' })).not.toBeInTheDocument()
  })

  it('finds the patient by name when opened without one', async () => {
    renderComposer({})

    await userEvent.type(
      await screen.findByRole('searchbox', { name: 'Bemor' }, { timeout: 5000 }),
      'aziza',
    )

    expect(
      await screen.findByRole('button', { name: /Aziza Karimova/ }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })
})
