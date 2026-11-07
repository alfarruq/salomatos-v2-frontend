import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { VoicePanel } from './VoicePanel'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

function enable() {
  server.use(
    http.get('/api/v1/voice/status/', () =>
      HttpResponse.json({ enabled: true, used_this_month: 3, monthly_limit: 1500 }),
    ),
  )
}

function renderPanel(onSubmit = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <VoicePanel
            clinicId="clinic:test"
            error={null}
            hint="Ismini ayting"
            isPending={false}
            onSubmit={onSubmit}
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return onSubmit
}

describe('VoicePanel', () => {
  beforeEach(() => signInAs('doctor'))

  it('stays hidden while the clinic has voice switched off', async () => {
    renderPanel()
    // The default mock answers `enabled: false`.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('button', { name: "Ovoz bilan to'ldirish" })).toBeNull()
  })

  it('sends the typed dictation and shows the month so far', async () => {
    enable()
    const onSubmit = renderPanel()

    await userEvent.click(await screen.findByRole('button', { name: "Ovoz bilan to'ldirish" }))
    const fill = screen.getByRole('button', { name: "Formani to'ldirish" })
    expect(fill).toHaveProperty('disabled', true)
    expect(screen.getByText('Bu oy: 3 / 1500')).toBeTruthy()

    await userEvent.type(screen.getByRole('textbox', { name: 'Diktovka matni' }), '  Aliyev Vali  ')
    await userEvent.click(fill)

    expect(onSubmit).toHaveBeenCalledWith('Aliyev Vali')
  })

  it('falls back to typing where the browser cannot recognise speech', async () => {
    enable()
    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: "Ovoz bilan to'ldirish" }))
    expect(screen.queryByRole('button', { name: 'Gapirish' })).toBeNull()
    expect(screen.getByText(/Bu brauzer ovozni tanimaydi/)).toBeTruthy()
  })
})
