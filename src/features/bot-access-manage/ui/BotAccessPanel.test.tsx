import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSession, useSessionStore } from '@/entities/session'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { BotAccessPanel } from './BotAccessPanel'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const PATIENT = '550e8400-e29b-41d4-a716-446655440000'
const URL = `/api/v1/patients/${PATIENT}/bot-access/`

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <BotAccessPanel clinicId="clinic:test" target={{ kind: 'patient', id: PATIENT }} />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('BotAccessPanel', () => {
  beforeEach(async () => {
    signInAs('owner')
    useSessionStore.getState().setSession(await fetchSession())
  })

  it('shows a patient login and password straight away, without a click', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ login: '12345678', password: 'k7m4q9rx', linked: false }),
      ),
    )

    renderPanel()

    expect(await screen.findByText('k7m4q9rx')).toBeTruthy()
    expect(screen.getByText('12345678')).toBeTruthy()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await userEvent.click(screen.getByRole('button', { name: 'Login va parolni nusxalash' }))
    expect(writeText).toHaveBeenCalledWith('login: 12345678\npassword: k7m4q9rx')
    // One copy button for both, none per row.
    expect(screen.getAllByRole('button', { name: /nusxalash/i })).toHaveLength(1)
  })

  it('shows the new password after a confirmed reset', async () => {
    server.use(
      http.post(`${URL}reset/`, () =>
        HttpResponse.json({ login: '12345678', password: 'newpass99', linked: false }),
      ),
      http.get(URL, () =>
        HttpResponse.json({ login: '12345678', password: 'newpass99', linked: false }),
      ),
    )

    renderPanel()
    await userEvent.click(await screen.findByRole('button', { name: 'Yangi parol' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Yangi parol berish' }))

    expect(await screen.findByText('newpass99')).toBeTruthy()
  })
})
