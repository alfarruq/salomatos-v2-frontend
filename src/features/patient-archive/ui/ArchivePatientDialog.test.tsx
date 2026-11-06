import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_PATIENTS } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { ArchivePatientDialog } from './ArchivePatientDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const PATIENT = { id: MOCK_PATIENTS[0]?.id ?? '', fullName: 'Aziza Karimova' }

function renderDialog(onArchived = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <ArchivePatientDialog
          clinicId="clinic:test"
          onArchived={onArchived}
          onOpenChange={vi.fn()}
          open
          patient={PATIENT}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return onArchived
}

describe('ArchivePatientDialog', () => {
  beforeEach(() => signInAs('owner'))

  it('archives through the archive action, never a DELETE', async () => {
    const methods: string[] = []
    server.events.on('request:start', ({ request }) => {
      methods.push(`${request.method} ${new URL(request.url).pathname}`)
    })
    const onArchived = renderDialog()

    await userEvent.click(await screen.findByRole('button', { name: 'Arxivlash' }))

    await waitFor(() => expect(onArchived).toHaveBeenCalledTimes(1))
    expect(methods).toEqual([`POST /api/v1/patients/${PATIENT.id}/archive/`])
  })

  it('says so when the role may not archive', async () => {
    signInAs('doctor')
    const onArchived = renderDialog()

    await userEvent.click(await screen.findByRole('button', { name: 'Arxivlash' }))

    expect(await screen.findByText("Bemorlarni arxivlashga ruxsatingiz yo'q.")).toBeInTheDocument()
    expect(onArchived).not.toHaveBeenCalled()
  })

  it('reports a server failure and stays open', async () => {
    server.use(
      http.post('/api/v1/patients/:id/archive/', () => HttpResponse.json({}, { status: 500 })),
    )
    renderDialog()

    await userEvent.click(await screen.findByRole('button', { name: 'Arxivlash' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
