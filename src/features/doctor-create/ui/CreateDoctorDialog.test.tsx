import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { CreateDoctorDialog } from './CreateDoctorDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

/** A client of its own — see `CreatePatientDialog.test.tsx` for why. */
function renderDialog(onCreated = vi.fn(), canSetPay = false) {
  const onOpenChange = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <CreateDoctorDialog
            canSetPay={canSetPay}
            clinicId="clinic:test"
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

function captureStaffPost(): { body: unknown } {
  const captured: { body: unknown } = { body: undefined }
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' && request.url.endsWith('/api/v1/staff/')) {
      captured.body = await request.clone().json()
    }
  })
  return captured
}

describe('CreateDoctorDialog', () => {
  // Staff are managed by the owner alone.
  beforeEach(() => signInAs('owner'))

  it('opens with "Stomatolog" preselected, most clinics being dental', async () => {
    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Turi' })).toHaveTextContent('Stomatolog')
    })
  })

  it('sends the preselected type without the person touching the select', async () => {
    const sent = captureStaffPost()

    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Turi' })).toHaveTextContent('Stomatolog')
    })
    await userEvent.type(screen.getByLabelText('F. I. Sh.'), 'Yangi Shifokor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550099')
    await userEvent.type(screen.getByLabelText('Login'), 'yangi.shifokor')
    await userEvent.type(screen.getByLabelText('Parol'), 'maxfiy-parol')
    await userEvent.click(screen.getByRole('button', { name: "Shifokor qo'shish" }))

    await waitFor(() =>
      expect(sent.body).toMatchObject({ role: 'doctor', specialty: mockId(5, 1) }),
    )
  })

  it('sends whatever type the person actually picks instead', async () => {
    const sent = captureStaffPost()

    renderDialog()

    const select = await screen.findByRole('combobox', { name: 'Turi' })
    await waitFor(() => expect(select).toHaveTextContent('Stomatolog'))

    await userEvent.click(select)
    await userEvent.click(screen.getByRole('option', { name: 'Ortodont' }))

    await userEvent.type(screen.getByLabelText('F. I. Sh.'), 'Yangi Shifokor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550099')
    await userEvent.type(screen.getByLabelText('Login'), 'yangi.shifokor')
    await userEvent.type(screen.getByLabelText('Parol'), 'maxfiy-parol')
    await userEvent.click(screen.getByRole('button', { name: "Shifokor qo'shish" }))

    await waitFor(() => expect(sent.body).toMatchObject({ specialty: mockId(5, 2) }))
  })

  it('resets to the default rather than to unassigned, so a second doctor gets one too', async () => {
    const { onCreated } = renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Turi' })).toHaveTextContent('Stomatolog')
    })
    await userEvent.type(screen.getByLabelText('F. I. Sh.'), 'Birinchi Shifokor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550001')
    await userEvent.type(screen.getByLabelText('Login'), 'yangi.shifokor')
    await userEvent.type(screen.getByLabelText('Parol'), 'maxfiy-parol')
    await userEvent.click(screen.getByRole('button', { name: "Shifokor qo'shish" }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())

    /*
     * `reset` clears `dirtyFields` back to untouched, which is what the
     * preselect effect watches — without restoring the default on success
     * itself, this would come back empty for every doctor after the first.
     */
    expect(screen.getByRole('combobox', { name: 'Turi' })).toHaveTextContent('Stomatolog')
  })

  it('sends the login and password the doctor will sign in with', async () => {
    const sent = captureStaffPost()

    renderDialog()

    await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Shifokor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550099')
    await userEvent.type(screen.getByLabelText('Login'), 'yangi.shifokor')
    await userEvent.type(screen.getByLabelText('Parol'), 'maxfiy-parol')
    await userEvent.click(screen.getByRole('button', { name: "Shifokor qo'shish" }))

    await waitFor(() =>
      expect(sent.body).toMatchObject({ username: 'yangi.shifokor', password: 'maxfiy-parol' }),
    )
  })

  it('refuses to create a doctor without a password', async () => {
    const { onCreated } = renderDialog()

    await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Shifokor')
    await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550099')
    await userEvent.type(screen.getByLabelText('Login'), 'yangi.shifokor')
    await userEvent.click(screen.getByRole('button', { name: "Shifokor qo'shish" }))

    expect(await screen.findByText("Parol kamida 8 belgidan iborat bo'lsin")).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  describe('pay terms', () => {
    async function fillDoctor() {
      await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Shifokor')
      await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550099')
      await userEvent.type(screen.getByLabelText('Login'), 'yangi.shifokor')
      await userEvent.type(screen.getByLabelText('Parol'), 'maxfiy-parol')
    }
    const submit = () => userEvent.click(screen.getByRole('button', { name: "Shifokor qo'shish" }))

    it('is hidden from someone who does not agree pay', async () => {
      renderDialog()
      await screen.findByLabelText('F. I. Sh.')
      expect(screen.queryByRole('switch', { name: 'Oylik maosh' })).not.toBeInTheDocument()
    })

    it('sends salary and percent together', async () => {
      const sent = captureStaffPost()
      renderDialog(vi.fn(), true)
      await fillDoctor()

      await userEvent.click(screen.getByRole('switch', { name: 'Oylik maosh' }))
      await userEvent.type(screen.getByLabelText("Oklad, so'm/oy"), '3000000')
      await userEvent.click(screen.getByRole('switch', { name: 'Davolash ishlaridan foiz' }))
      await userEvent.type(screen.getByLabelText('Foiz, %'), '50')
      await submit()

      await waitFor(() =>
        expect(sent.body).toMatchObject({
          compensation: { percent: 50, fixed: 3000000, base: 'collected' },
        }),
      )
    })

    it('sends a percent alone, and nothing when both are off', async () => {
      const sent = captureStaffPost()
      const { onCreated } = renderDialog(vi.fn(), true)
      await fillDoctor()

      await userEvent.click(screen.getByRole('switch', { name: 'Davolash ishlaridan foiz' }))
      await userEvent.type(screen.getByLabelText('Foiz, %'), '40')
      await submit()
      await waitFor(() =>
        expect(sent.body).toMatchObject({ compensation: { percent: 40, fixed: 0 } }),
      )
      await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())

      // The form is reset, both switches off again: a doctor without terms yet.
      await userEvent.type(screen.getByLabelText('F. I. Sh.'), 'Ikkinchi Shifokor')
      await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550098')
      await userEvent.type(screen.getByLabelText('Login'), 'ikkinchi.shifokor')
      await userEvent.type(screen.getByLabelText('Parol'), 'maxfiy-parol')
      await submit()
      await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(2))
      expect(sent.body).not.toHaveProperty('compensation')
    })

    it('refuses a switched-on half left empty', async () => {
      const { onCreated } = renderDialog(vi.fn(), true)
      await fillDoctor()

      await userEvent.click(screen.getByRole('switch', { name: 'Oylik maosh' }))
      await submit()

      expect(await screen.findByText("Bu maydon to'ldirilishi shart")).toBeInTheDocument()
      expect(onCreated).not.toHaveBeenCalled()
    })
  })
})
