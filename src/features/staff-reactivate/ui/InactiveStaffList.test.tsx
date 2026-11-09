import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MOCK_STAFF } from '@/shared/api/mocks/fixtures'
import { resetMockDatabase } from '@/shared/api/mocks/handlers'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { InactiveStaffList } from './InactiveStaffList'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockDatabase()
  signOut()
})
afterAll(() => server.close())

const MEMBER = { id: String(MOCK_STAFF[0]?.id), fullName: 'Sardor Usmonov' }

describe('InactiveStaffList', () => {
  it('brings a deactivated member back through the reactivate action', async () => {
    signInAs('owner')
    const calls: string[] = []
    server.events.on('request:start', ({ request }) => {
      calls.push(`${request.method} ${new URL(request.url).pathname}`)
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={createI18n('uz-Latn')}>
          <Suspense fallback={null}>
            <InactiveStaffList clinicId="clinic:test" staff={[MEMBER]} />
          </Suspense>
        </I18nextProvider>
      </QueryClientProvider>,
    )

    await userEvent.click(
      await screen.findByRole('button', { name: 'Qayta faollashtirish — Sardor Usmonov' }),
    )

    await waitFor(() => expect(calls).toEqual([`POST /api/v1/staff/${MEMBER.id}/reactivate/`]))
  })

  it('renders nothing when nobody is deactivated', () => {
    const { container } = render(
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <InactiveStaffList clinicId="clinic:test" staff={[]} />
      </I18nextProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
