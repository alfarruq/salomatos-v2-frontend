import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
  beforeEach(() => signInAs('owner'))

  it('asks the server for the password only when staff ask to see it', async () => {
    let reads = 0
    server.use(
      http.get(URL, () => {
        reads += 1
        return HttpResponse.json({ login: '12345678', password: 'k7m4q9rx', linked: false })
      }),
    )

    renderPanel()
    const show = await screen.findByRole('button', { name: "Login va parolni ko'rsatish" })
    expect(reads).toBe(0)
    expect(screen.queryByText('k7m4q9rx')).toBeNull()

    await userEvent.click(show)

    expect(await screen.findByText('k7m4q9rx')).toBeTruthy()
    expect(screen.getByText('12345678')).toBeTruthy()
    expect(reads).toBe(1)
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
