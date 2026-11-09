import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { todayCalendarDate } from '@/shared/lib/calendarDate'
import { DashboardMoney } from './DashboardMoney'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

describe('DashboardMoney', () => {
  it("shows today's collected, billed and owed sums", async () => {
    signInAs('owner')
    const rootRoute = createRootRoute({
      component: () => (
        <Suspense fallback={null}>
          <DashboardMoney clinicId="clinic:test" today={todayCalendarDate()} />
        </Suspense>
      ),
    })
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={createI18n('uz-Latn')}>
          <RouterProvider router={router} />
        </I18nextProvider>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Bugungi tushum')).toBeInTheDocument()
    expect(screen.getByText('Bugun bajarilgan ish')).toBeInTheDocument()
    expect(screen.getByText('Umumiy qarz')).toBeInTheDocument()
  })
})
