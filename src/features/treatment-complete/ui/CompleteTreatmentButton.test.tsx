import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_PROCEDURES } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { CompleteTreatmentButton } from './CompleteTreatmentButton'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const procedure = MOCK_PROCEDURES[0]

function renderButton(onCompleted = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <CompleteTreatmentButton
          clinicId="clinic:test"
          onCompleted={onCompleted}
          treatmentId={procedure?.id ?? ''}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return onCompleted
}

describe('CompleteTreatmentButton', () => {
  beforeEach(() => signInAs('doctor'))

  it('posts to the complete action and hands back the finished treatment', async () => {
    let calledPath = ''
    server.use(
      http.post('/api/v1/procedures/:id/complete/', ({ request }) => {
        calledPath = new URL(request.url).pathname
        return HttpResponse.json({
          ...procedure,
          status: 'completed',
          completed_at: '2026-11-07T10:00:00Z',
        })
      }),
    )
    const onCompleted = renderButton()

    await userEvent.click(await screen.findByRole('button', { name: 'Tugallash' }))

    await waitFor(() => expect(onCompleted).toHaveBeenCalledTimes(1))
    expect(calledPath).toBe(`/api/v1/procedures/${procedure?.id}/complete/`)
    expect(onCompleted.mock.calls[0]?.[0]).toMatchObject({ status: 'done' })
  })

  it('does not report success when the server refuses', async () => {
    server.use(
      http.post('/api/v1/procedures/:id/complete/', () =>
        HttpResponse.json({ detail: 'Already completed.' }, { status: 400 }),
      ),
    )
    const onCompleted = renderButton()

    await userEvent.click(await screen.findByRole('button', { name: 'Tugallash' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Tugallash' })).toBeEnabled())
    expect(onCompleted).not.toHaveBeenCalled()
  })
})
