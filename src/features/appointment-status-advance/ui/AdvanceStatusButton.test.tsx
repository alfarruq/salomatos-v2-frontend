import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fetchSession, useSessionStore } from '@/entities/session'
import { MOCK_APPOINTMENTS } from '@/shared/api/mocks/fixtures'
import { resetMockDatabase } from '@/shared/api/mocks/handlers'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { AdvanceStatusButton } from './AdvanceStatusButton'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockDatabase()
  signOut()
  useSessionStore.getState().clear()
})
afterAll(() => server.close())

const ID = String(MOCK_APPOINTMENTS[0]?.id)

function renderButton(status: 'scheduled' | 'completed') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <AdvanceStatusButton
            appointment={{ id: ID, status, fullName: 'Aziza Karimova' }}
            clinicId="clinic:test"
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('AdvanceStatusButton', () => {
  it('marks a booked patient as arrived in one tap', async () => {
    signInAs('admin')
    useSessionStore.getState().setSession(await fetchSession())
    const bodies: string[] = []
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PATCH') bodies.push(await request.clone().text())
    })
    renderButton('scheduled')

    await userEvent.click(await screen.findByRole('button', { name: 'Keldi — Aziza Karimova' }))

    await waitFor(() => expect(bodies).toEqual(['{"status":"arrived"}']))
  })

  it('shows nothing for a finished visit', async () => {
    signInAs('admin')
    renderButton('completed')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
