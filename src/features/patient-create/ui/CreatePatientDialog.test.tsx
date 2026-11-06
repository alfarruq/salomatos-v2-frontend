import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorEnvelope, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { toTypedDate } from '@/shared/lib/calendarDate'
import { clinicNow } from '@/shared/lib/datetime'
import { CreatePatientDialog } from './CreatePatientDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

/**
 * A client of its own rather than the app's `createQueryClient`.
 *
 * Two reasons. The boundaries rule is one: a feature may not import from `app`
 * (§3.3), and a test in this slice is still in this slice. The better one is
 * that these assertions are about the dialog, not about the application's retry
 * policy — a component test that fails when the cache configuration changes is
 * testing the wrong thing.
 */
function renderDialog({ offerTreatment = false }: { offerTreatment?: boolean } = {}) {
  const onCreated = vi.fn()
  const onOpenChange = vi.fn()

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    // Locale pinned to the product default: jsdom reports en-US, and these
    // assertions are about what staff actually see.
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <CreatePatientDialog
            clinicId="clinic:test"
            offerTreatment={offerTreatment}
            onCreated={onCreated}
            onOpenChange={onOpenChange}
            open
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { onCreated, onOpenChange }
}

describe('CreatePatientDialog', () => {
  beforeEach(() => signInAs('admin'))

  it("opens with today's date as the birth date", async () => {
    renderDialog()

    expect(await screen.findByLabelText("Tug'ilgan sana")).toHaveValue(
      toTypedDate(clinicNow().date),
    )
  })

  it('lets the birth date be typed as dd/mm/yyyy', async () => {
    renderDialog()

    const birthDate = await screen.findByLabelText("Tug'ilgan sana")
    await userEvent.clear(birthDate)
    await userEvent.type(birthDate, '12051994')

    expect(birthDate).toHaveValue('12/05/1994')
  })

  it('refuses a birth date that is not a real day', async () => {
    const { onCreated } = renderDialog()

    await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Bemor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550022')
    const birthDate = screen.getByLabelText("Tug'ilgan sana")
    await userEvent.clear(birthDate)
    await userEvent.type(birthDate, '31021994')
    await userEvent.click(screen.getByRole('button', { name: "Bemor qo'shish" }))

    expect(await screen.findByText("Qiymat noto'g'ri")).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('creates a patient and closes', async () => {
    const { onCreated, onOpenChange } = renderDialog()

    await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Bemor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550022')
    await userEvent.click(await screen.findByRole('combobox', { name: 'Shifokor' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Sardor Usmonov' }))
    await userEvent.click(screen.getByRole('button', { name: "Bemor qo'shish" }))

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onCreated.mock.calls[0]?.[1]).toMatchObject({ addTreatment: false })
  })

  it('hides the treatment checkbox unless the caller offers it', async () => {
    renderDialog()

    await screen.findByLabelText('F. I. Sh.')
    expect(screen.queryByRole('checkbox', { name: "Muolaja qo'shish" })).not.toBeInTheDocument()
  })

  it('hands the new patient and the chosen doctor on when a treatment is asked for', async () => {
    const { onCreated } = renderDialog({ offerTreatment: true })

    await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Bemor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550022')
    await userEvent.click(await screen.findByRole('combobox', { name: 'Shifokor' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Sardor Usmonov' }))
    await userEvent.click(screen.getByRole('checkbox', { name: "Muolaja qo'shish" }))
    await userEvent.click(screen.getByRole('button', { name: "Qo'shish va davom etish" }))

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    const [patient, followUp] = onCreated.mock.calls[0] ?? []
    expect(patient).toMatchObject({ id: expect.any(String) })
    expect(followUp).toMatchObject({ addTreatment: true, doctorId: mockId(4, 4) })
  })

  it('puts the server`s rejection on the field that caused it', async () => {
    server.use(
      http.post('/api/v1/patients/', () =>
        HttpResponse.json(
          errorEnvelope({
            message: 'Validation error',
            messageKey: 'validation_error',
            errors: { phone_number: 'invalid' },
          }),
          { status: 400 },
        ),
      ),
    )
    renderDialog()

    await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Bemor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550022')
    await userEvent.click(screen.getByRole('button', { name: "Bemor qo'shish" }))

    /*
     * §10, and the reason field errors are carried as codes: DRF answers
     * `{"phone_number": "invalid"}`, which becomes `validation.invalid` and is
     * translated here — beside the input, not in a generic banner.
     */
    expect(await screen.findByText("Qiymat noto'g'ri")).toBeInTheDocument()
  })

  it('does not send an incomplete phone number to the server', async () => {
    const { onCreated } = renderDialog()

    await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Bemor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '9355')
    await userEvent.click(screen.getByRole('button', { name: "Bemor qo'shish" }))

    expect(await screen.findByText("Telefon raqami noto'g'ri")).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('rejects a name too short to identify anyone', async () => {
    const { onCreated } = renderDialog()

    await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'A')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550022')
    await userEvent.click(screen.getByRole('button', { name: "Bemor qo'shish" }))

    expect(await screen.findByText('Juda qisqa')).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })
})
