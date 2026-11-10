import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MOCK_CLINICS } from '@/shared/api/mocks/fixtures'
import { resetMockDatabase } from '@/shared/api/mocks/handlers'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { setTenantScope } from '@/shared/api/tenantScope'
import { createI18n } from '@/shared/i18n'
import { BranchTable } from './BranchTable'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockDatabase()
  signOut()
})
afterAll(() => server.close())

const CURRENT = { id: MOCK_CLINICS.main.id, name: MOCK_CLINICS.main.name }

function renderTable() {
  signInAs('owner')
  setTenantScope({ kind: 'clinic', id: CURRENT.id })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <BranchTable clinicId="clinic:test" currentBranch={CURRENT} />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('BranchTable', () => {
  it('lists the branches and marks the current one, which cannot be closed from inside', async () => {
    renderTable()

    const current = (await screen.findByText(MOCK_CLINICS.main.name)).closest('tr')
    const other = (await screen.findByText(MOCK_CLINICS.second.name)).closest('tr')
    if (current === null || other === null) throw new Error('rows missing')
    expect(within(current).getByText('Joriy')).toBeInTheDocument()
    expect(within(current).queryByRole('button', { name: 'Filialni yopish' })).toBeNull()
    expect(within(other).getByRole('button', { name: 'Filialni yopish' })).toBeInTheDocument()
  })

  it('opens a branch with the current price list copied', async () => {
    const bodies: unknown[] = []
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST') bodies.push(await request.clone().json())
    })
    renderTable()

    await userEvent.click(await screen.findByRole('button', { name: "Filial qo'shish" }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Filial/ }), 'Sergeli')
    await userEvent.click(within(dialog).getByRole('button', { name: "Filial qo'shish" }))

    await waitFor(() =>
      expect(bodies).toEqual([
        { name: 'Sergeli', phone_number: '', address: '', copy_catalog_from: CURRENT.id },
      ]),
    )
    expect(await screen.findByText('Sergeli')).toBeInTheDocument()
  })

  it('closes another branch after confirmation', async () => {
    renderTable()

    const other = (await screen.findByText(MOCK_CLINICS.second.name)).closest('tr')
    if (other === null) throw new Error('row missing')
    await userEvent.click(within(other).getByRole('button', { name: 'Filialni yopish' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Filialni yopish' }))

    expect(await screen.findByText('Yopilgan')).toBeInTheDocument()
  })
})
