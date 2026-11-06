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
function renderDialog(onCreated = vi.fn()) {
  const onOpenChange = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <CreateDoctorDialog
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
  beforeEach(() => signInAs('admin'))

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
})
