import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { CreateAdministratorDialog } from './CreateAdministratorDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

/** A client of its own — see `CreatePatientDialog.test.tsx` for why. */
function renderDialog() {
  const onOpenChange = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <CreateAdministratorDialog clinicId="clinic:test" onOpenChange={onOpenChange} open />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { onOpenChange }
}

async function fillIn(username: string) {
  await userEvent.type(await screen.findByLabelText('F. I. Sh.'), 'Yangi Admin')
  await userEvent.type(screen.getByLabelText('Telefon raqami'), '935550077')
  await userEvent.type(screen.getByLabelText('Login'), username)
  await userEvent.type(screen.getByLabelText('Parol'), 'maxfiy-parol')
  await userEvent.click(screen.getByRole('button', { name: "Admin qo'shish" }))
}

describe('CreateAdministratorDialog', () => {
  // Staff are managed by the owner alone.
  beforeEach(() => signInAs('owner'))

  it('creates an admin membership with the login and password, never a clinic', async () => {
    const captured: { body: unknown } = { body: undefined }
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/api/v1/staff/')) {
        captured.body = await request.clone().json()
      }
    })

    const { onOpenChange } = renderDialog()
    await fillIn('yangi.admin')

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    // The branch comes from the X-Clinic-Id header, never from the body.
    expect(captured.body).not.toHaveProperty('clinic')
    expect(captured.body).toMatchObject({
      role: 'admin',
      username: 'yangi.admin',
      password: 'maxfiy-parol',
      full_name: 'Yangi Admin',
      phone_number: '+998935550077',
    })
  })

  it('puts a taken login back on the login input', async () => {
    renderDialog()
    await fillIn('admin')

    expect(await screen.findByText('Bu qiymat allaqachon band')).toBeInTheDocument()
  })

  it('refuses a login the server could not match', async () => {
    renderDialog()
    await fillIn('yangi admin')

    expect(
      await screen.findByText('Faqat lotin harflari, raqamlar va . @ + - _ belgilari'),
    ).toBeInTheDocument()
  })
})
