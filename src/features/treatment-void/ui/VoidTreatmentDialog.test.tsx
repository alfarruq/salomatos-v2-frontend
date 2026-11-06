import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_PROCEDURES } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { VoidTreatmentDialog } from './VoidTreatmentDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

function renderDialog(onVoided = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <VoidTreatmentDialog
          clinicId="clinic:test"
          onOpenChange={vi.fn()}
          onVoided={onVoided}
          open
          treatment={{
            id: MOCK_PROCEDURES[0]?.id ?? '',
            treatmentTypeName: 'Plomba',
            toothNumber: 36,
          }}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return onVoided
}

describe('VoidTreatmentDialog', () => {
  beforeEach(() => signInAs('owner'))

  it('will not void without a reason', async () => {
    renderDialog()

    expect(await screen.findByRole('button', { name: 'Yaroqsiz deb belgilash' })).toBeDisabled()
  })

  it('sends the reason to the void action', async () => {
    let body: unknown
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST') body = await request.clone().json()
    })
    const onVoided = renderDialog()

    await userEvent.type(await screen.findByRole('textbox'), "Noto'g'ri tish")
    await userEvent.click(screen.getByRole('button', { name: 'Yaroqsiz deb belgilash' }))

    await waitFor(() => expect(onVoided).toHaveBeenCalledTimes(1))
    expect(body).toEqual({ reason: "Noto'g'ri tish" })
  })

  it("explains a doctor's 403 instead of failing silently", async () => {
    signInAs('doctor')
    renderDialog()

    await userEvent.type(await screen.findByRole('textbox'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Yaroqsiz deb belgilash' }))

    expect(
      await screen.findByText("Muolajani yaroqsiz deb belgilashga ruxsatingiz yo'q."),
    ).toBeInTheDocument()
  })
})
