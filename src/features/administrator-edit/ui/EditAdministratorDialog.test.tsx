import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import * as v from 'valibot'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { administratorSchema, toAdministrator } from '@/entities/administrator'
import { MOCK_STAFF } from '@/shared/api/mocks/fixtures'
import { resetMockDatabase } from '@/shared/api/mocks/handlers'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { EditAdministratorDialog } from './EditAdministratorDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockDatabase()
  signOut()
})
afterAll(() => server.close())

const ADMIN = toAdministrator(
  v.parse(
    administratorSchema,
    MOCK_STAFF.find((row) => row.role === 'admin'),
  ),
)

function renderDialog() {
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <EditAdministratorDialog
            administrator={ADMIN}
            clinicId="clinic:test"
            onOpenChange={onOpenChange}
            open
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return onOpenChange
}

async function patchBodies(run: () => Promise<void>): Promise<Record<string, unknown>[]> {
  const bodies: Record<string, unknown>[] = []
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'PATCH') bodies.push(await request.clone().json())
  })
  await run()
  return bodies
}

describe('EditAdministratorDialog', () => {
  it('keeps the password when the field is left empty', async () => {
    signInAs('owner')
    const onOpenChange = renderDialog()
    const bodies = await patchBodies(async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Saqlash' }))
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })
    expect(bodies[0]).not.toHaveProperty('password')
    expect(bodies[0]).not.toHaveProperty('role')
  })

  it('sends a new password when one is typed', async () => {
    signInAs('owner')
    const onOpenChange = renderDialog()
    const bodies = await patchBodies(async () => {
      await userEvent.type(await screen.findByLabelText('Yangi parol'), 'Yangi-parol-2026')
      await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }))
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })
    expect(bodies[0]?.password).toBe('Yangi-parol-2026')
  })
})
