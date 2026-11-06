import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_SERVICES } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { CreateAppointmentDialog } from './CreateAppointmentDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const i18n = createI18n('uz-Latn')

function wrap(children: ReactNode) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Suspense fallback={null}>{children}</Suspense>
      </I18nextProvider>
    </QueryClientProvider>
  )
}

describe('CreateAppointmentDialog', () => {
  beforeEach(() => signInAs('admin'))

  it('opens on the date it is given now, not the one it was first mounted with', async () => {
    const props = { clinicId: 'clinic:test', onOpenChange: vi.fn() }
    const { rerender } = render(
      wrap(<CreateAppointmentDialog {...props} defaultDate="2026-10-08" open />),
    )
    expect(await screen.findByText('08.10.2026')).toBeInTheDocument()

    // Closed, then reopened a day later — the dialog itself stayed mounted.
    rerender(wrap(<CreateAppointmentDialog {...props} defaultDate="2026-10-08" open={false} />))
    rerender(wrap(<CreateAppointmentDialog {...props} defaultDate="2026-10-09" open />))

    expect(await screen.findByText('09.10.2026')).toBeInTheDocument()
    expect(screen.queryByText('08.10.2026')).not.toBeInTheDocument()
  })

  it('links an existing patient found by name', async () => {
    render(
      wrap(
        <CreateAppointmentDialog
          clinicId="clinic:test"
          defaultDate="2026-10-08"
          onOpenChange={vi.fn()}
          open
        />,
      ),
    )

    const input = await screen.findByRole('textbox', { name: 'Bemor' })
    fireEvent.change(input, { target: { value: 'Aziza' } })

    fireEvent.click(await screen.findByRole('button', { name: /Aziza Karimova/ }))
    expect(input).toHaveValue('Aziza Karimova')
    expect(
      screen.getByRole('button', { name: "Bemorni bog'lashni bekor qilish" }),
    ).toBeInTheDocument()
  })

  describe('service', () => {
    beforeEach(() => queryClient.clear())

    function renderDialog() {
      render(
        wrap(
          <CreateAppointmentDialog
            clinicId="clinic:test"
            defaultDate="2026-10-08"
            onOpenChange={vi.fn()}
            open
          />,
        ),
      )
    }

    async function chooseDoctor(name: RegExp) {
      await userEvent.click(await screen.findByRole('combobox', { name: /^Shifokor/ }))
      await userEvent.click(await screen.findByRole('option', { name }))
    }

    it("offers the doctor's specialty and the general services only", async () => {
      renderDialog()
      // Nodira is the orthodontist; "Plomba" is filed under the therapist.
      await chooseDoctor(/Nodira Karimova/)

      await userEvent.click(screen.getByRole('combobox', { name: /^Xizmat/ }))
      expect(await screen.findByRole('option', { name: 'Tozalash' })).toBeInTheDocument()
      expect(screen.queryByRole('option', { name: 'Plomba' })).not.toBeInTheDocument()
    })

    it('takes the visit length from the picked service', async () => {
      renderDialog()
      await chooseDoctor(/Sardor Usmonov/)

      await userEvent.click(screen.getByRole('combobox', { name: /^Xizmat/ }))
      await userEvent.click(await screen.findByRole('option', { name: 'Plomba' }))

      expect(screen.getByRole('combobox', { name: /^Davomiyligi/ })).toHaveTextContent(
        String(MOCK_SERVICES[0]?.duration_minutes),
      )
    })
  })
})
