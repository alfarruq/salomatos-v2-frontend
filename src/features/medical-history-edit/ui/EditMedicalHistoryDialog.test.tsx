import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type MedicalHistory, patientKeys } from '@/entities/patient'
import { MOCK_PATIENTS } from '@/shared/api/mocks/fixtures'
import { resetMockDatabase } from '@/shared/api/mocks/handlers'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { EditMedicalHistoryDialog } from './EditMedicalHistoryDialog'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockDatabase()
  signOut()
})
afterAll(() => server.close())

const PATIENT_ID = MOCK_PATIENTS[0]?.id ?? ''
const EMPTY: MedicalHistory = {
  allergies: null,
  chronicConditions: null,
  currentMedications: null,
  isPregnant: null,
  notes: null,
  updatedAt: null,
}

function renderDialog(showPregnancy = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <EditMedicalHistoryDialog
          clinicId="clinic:test"
          history={EMPTY}
          onOpenChange={onOpenChange}
          open
          patientId={PATIENT_ID}
          showPregnancy={showPregnancy}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  )
  return { queryClient, onOpenChange }
}

describe('EditMedicalHistoryDialog', () => {
  beforeEach(() => signInAs('owner'))

  it('saves the allergy and puts the stored record in the cache', async () => {
    const { queryClient, onOpenChange } = renderDialog()

    await userEvent.type(await screen.findByLabelText('Allergiya'), 'Lidokain')
    await userEvent.click(screen.getByRole('radio', { name: 'Homilador emas' }))
    await userEvent.click(screen.getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    const cached = queryClient.getQueryData<MedicalHistory>(
      patientKeys.medicalHistory('clinic:test', PATIENT_ID),
    )
    expect(cached?.allergies).toBe('Lidokain')
    expect(cached?.isPregnant).toBe(false)
  })

  it('does not ask a male patient about pregnancy', async () => {
    renderDialog(false)
    await screen.findByLabelText('Allergiya')
    expect(screen.queryByRole('radio', { name: 'Homilador emas' })).not.toBeInTheDocument()
  })
})
