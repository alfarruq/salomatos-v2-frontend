import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import * as v from 'valibot'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { appointmentSchema, toAppointment } from '@/entities/appointment'
import { MOCK_APPOINTMENTS } from '@/shared/api/mocks/fixtures'
import { resetMockDatabase } from '@/shared/api/mocks/handlers'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { CancelAppointmentDialog } from './CancelAppointmentDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockDatabase()
  signOut()
})
afterAll(() => server.close())

const APPOINTMENT = toAppointment(v.parse(appointmentSchema, MOCK_APPOINTMENTS[0]))

describe('CancelAppointmentDialog', () => {
  beforeEach(() => signInAs('owner'))

  it('cancels through the status, never a DELETE', async () => {
    const calls: string[] = []
    server.events.on('request:start', async ({ request }) => {
      calls.push(
        `${request.method} ${new URL(request.url).pathname} ${await request.clone().text()}`,
      )
    })
    const onOpenChange = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={createI18n('uz-Latn')}>
          <CancelAppointmentDialog
            appointment={APPOINTMENT}
            clinicId="clinic:test"
            onOpenChange={onOpenChange}
            open
          />
        </I18nextProvider>
      </QueryClientProvider>,
    )

    await userEvent.click(await screen.findByRole('button', { name: 'Bekor qilish' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(calls).toEqual([`PATCH /api/v1/appointments/${APPOINTMENT.id}/ {"status":"cancelled"}`])
  })
})
