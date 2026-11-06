import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_PATIENTS, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { RecipeEditor } from './RecipeEditor'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const AZIZA = MOCK_PATIENTS[0]?.id ?? ''

function renderEditor() {
  const onOpenChange = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <RecipeEditor
            clinicId="clinic:test"
            onOpenChange={onOpenChange}
            open
            patientId={AZIZA}
            patientName="Dilnoza Rahimova"
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { onOpenChange }
}

function captureBody() {
  const captured: { body: unknown } = { body: undefined }
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' && request.url.includes('/api/v1/prescriptions/')) {
      captured.body = await request.clone().json()
    }
  })
  return captured
}

async function chooseDoctor() {
  await userEvent.click(await screen.findByRole('combobox', { name: 'Shifokor' }))
  await userEvent.click(await screen.findByRole('option', { name: /^Sardor Usmonov/ }))
}

/** Fills the row the editor opens with. */
async function pickMedicine(query: string, option: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Dori nomi' }))
  await userEvent.type(await screen.findByPlaceholderText('Dori nomini qidiring…'), query)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

const SAVE = 'Retseptni saqlash'

describe('RecipeEditor', () => {
  beforeEach(() => signInAs('admin'))

  it('opens with the patient, one empty row and nothing to save', async () => {
    renderEditor()

    expect(await screen.findByDisplayValue('Dilnoza Rahimova')).toBeInTheDocument()
    expect(screen.getByText('0 ta dori')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Dori nomi' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: SAVE })).toBeDisabled()
  })

  it('opens the name picker of an added row straight away', async () => {
    renderEditor()

    await userEvent.click(await screen.findByRole('button', { name: "Dori qo'shish" }))

    expect(screen.getAllByRole('button', { name: 'Dori nomi' })).toHaveLength(2)
    expect(await screen.findByPlaceholderText('Dori nomini qidiring…')).toHaveFocus()
  })

  it('shows the hint once every row is removed', async () => {
    renderEditor()

    await userEvent.click(await screen.findByRole('button', { name: 'Dorini olib tashlash' }))

    expect(screen.getByText(/Hali dori qo'shilmagan/)).toBeInTheDocument()
  })

  it('fills the whole row from a catalog pick and saves it', async () => {
    const captured = captureBody()
    const { onOpenChange } = renderEditor()

    await chooseDoctor()
    await pickMedicine('Ketorol', 'Ketorol 10 mg')

    expect(screen.getByRole('button', { name: 'Dori nomi' })).toHaveTextContent('Ketorol 10 mg')
    expect(screen.getByRole('combobox', { name: 'Qabul' })).toHaveTextContent('3 mahal/kun')

    await userEvent.click(screen.getByRole('button', { name: SAVE }))

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(captured.body).toEqual({
      patient: AZIZA,
      doctor: mockId(4, 4),
      notes: '',
      items: [
        {
          medicine: 'Ketorol 10 mg',
          dose: '1',
          form: 'tablet',
          times_per_day: 3,
          duration_days: 3,
          meal_relation: 'after',
          instructions: '',
        },
      ],
    })
  })

  it('takes a name that is not in the catalog', async () => {
    const captured = captureBody()
    renderEditor()

    await chooseDoctor()
    await pickMedicine('Vitamin E', '"Vitamin E" ni qo\'shish')
    await userEvent.click(screen.getByRole('button', { name: SAVE }))

    await vi.waitFor(() =>
      expect(captured.body).toMatchObject({
        items: [{ medicine: 'Vitamin E', dose: '1', form: 'tablet', times_per_day: 2 }],
      }),
    )
  })

  it('keeps the dialog and the medicines when the server refuses', async () => {
    server.use(
      http.post('/api/v1/prescriptions/', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    const { onOpenChange } = renderEditor()

    await chooseDoctor()
    await pickMedicine('Nimesil', 'Nimesil 100 mg')
    await userEvent.click(screen.getByRole('button', { name: SAVE }))

    await vi.waitFor(() => expect(screen.getByRole('button', { name: SAVE })).not.toBeDisabled())
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Dori nomi' })).toHaveTextContent('Nimesil 100 mg')
  })
})
