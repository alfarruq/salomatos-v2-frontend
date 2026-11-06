import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PatientFilters } from '@/entities/patient'
import { fetchSession, useSessionStore } from '@/entities/session'
import { MOCK_PATIENTS, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { PatientTable } from './PatientTable'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
  useSessionStore.getState().clear()
})
afterAll(() => server.close())

const CLINIC_ID = 'clinic:test'
const AZIZA = MOCK_PATIENTS[0]?.id ?? ''

const filters: Omit<PatientFilters, 'search'> = { archived: false, doctorId: null, page: 1 }

/** `<Can>` reads the store, so the session has to be in it, not only the token. */
async function signIn(user: 'admin' | 'owner' = 'admin', branch?: 'all') {
  signInAs(user, branch)
  useSessionStore.getState().setSession(await fetchSession())
}

function renderTable(filterOverrides: Partial<Omit<PatientFilters, 'search'>> = {}) {
  const onOpenPatient = vi.fn()
  const onFiltersChange = vi.fn()

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <PatientTable
            clinicId={CLINIC_ID}
            filters={{ ...filters, ...filterOverrides }}
            heading={<h1>Bemorlar</h1>}
            onFiltersChange={onFiltersChange}
            onOpenPatient={onOpenPatient}
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { onOpenPatient, onFiltersChange, queryClient }
}

describe('PatientTable', () => {
  it('renders the rows the server sent', async () => {
    await signIn()
    renderTable()

    expect(await screen.findByText('Aziza Karimova')).toBeInTheDocument()
    expect(screen.getByText('Bekzod Aliyev')).toBeInTheDocument()
  })

  it('formats a phone number the way the form does', async () => {
    await signIn()
    renderTable()

    expect(await screen.findByText('+998-90-100-00-01')).toBeInTheDocument()
  })

  it('lays the columns out in the order the desk reads them', async () => {
    await signIn()
    renderTable()

    await screen.findByText('Aziza Karimova')
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent)
    expect(headers).toEqual(['Ism', 'Telefon', "Tug'ilgan sana", 'Shifokor', 'Holat', ''])
  })

  it("counts the clinic's patients above the list", async () => {
    await signIn()
    renderTable()

    const tile = (await screen.findByText('Jami bemorlar')).parentElement
    await waitFor(() => expect(tile).toHaveTextContent('3'))
  })

  it('offers to clear the filters only when one is set', async () => {
    await signIn()
    renderTable()
    await screen.findByText('Aziza Karimova')
    expect(screen.queryByRole('button', { name: 'Filtrlarni tozalash' })).not.toBeInTheDocument()
  })

  it('clears every filter at once', async () => {
    await signIn()
    const user = userEvent.setup()
    const { onFiltersChange } = renderTable({ archived: true, page: 3 })

    await user.click(await screen.findByRole('button', { name: 'Filtrlarni tozalash' }))

    expect(onFiltersChange).toHaveBeenCalledWith(filters)
  })

  it('shows a card list instead of a table on a phone', async () => {
    await signIn()
    const original = window.matchMedia
    window.matchMedia = vi.fn((query: string) => ({
      ...original(query),
      matches: query.includes('max-width'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    try {
      const { onOpenPatient } = renderTable()

      await userEvent.click(await screen.findByRole('button', { name: /Aziza Karimova/ }))

      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(onOpenPatient).toHaveBeenCalledWith(AZIZA)
    } finally {
      window.matchMedia = original
    }
  })

  it('opens a patient when the row is clicked', async () => {
    await signIn()
    const { onOpenPatient } = renderTable()

    await userEvent.click(await screen.findByText('Aziza Karimova'))

    expect(onOpenPatient).toHaveBeenCalledWith(AZIZA)
  })

  it('warms the card on hover so the click has nothing to wait for', async () => {
    await signIn()
    const { queryClient } = renderTable()

    await userEvent.hover(await screen.findByText('Aziza Karimova'))

    await waitFor(() => {
      expect(
        queryClient.getQueryData(['clinics', CLINIC_ID, 'patients', 'detail', AZIZA]),
      ).toBeDefined()
    })
  })

  it('searches without ever putting the term in the URL', async () => {
    // §3: a patient's name in the address bar reaches logs, Referer and history.
    await signIn()
    const before = window.location.href
    renderTable()

    await screen.findByText('Aziza Karimova')
    await userEvent.type(screen.getByLabelText('Bemorlarni qidirish'), 'Bekzod')

    expect(await screen.findByText('Bekzod Aliyev')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Aziza Karimova')).not.toBeInTheDocument())

    expect(window.location.href).toBe(before)
  })

  it('offers a way back when a search matches nothing', async () => {
    await signIn()
    renderTable()

    await screen.findByText('Aziza Karimova')
    await userEvent.type(screen.getByLabelText('Bemorlarni qidirish'), 'Zzzz')

    expect(await screen.findByText('Hech narsa topilmadi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Barcha bemorlarni ko'rsatish" })).toBeInTheDocument()
  })

  it('opens the row menu without navigating to the patient', async () => {
    await signIn()
    const { onOpenPatient } = renderTable()

    await screen.findByText('Aziza Karimova')
    await userEvent.click(screen.getByRole('button', { name: 'Tahrirlash — Aziza Karimova' }))

    expect(screen.getByRole('menuitem', { name: 'Tahrirlash' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Arxivlash' })).toBeInTheDocument()
    expect(onOpenPatient).not.toHaveBeenCalled()
  })

  it('opens the edit dialog from the row menu', async () => {
    await signIn()
    renderTable()

    await screen.findByText('Aziza Karimova')
    await userEvent.click(screen.getByRole('button', { name: 'Tahrirlash — Aziza Karimova' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Tahrirlash' }))

    expect(await screen.findByRole('heading', { name: 'Bemorni tahrirlash' })).toBeInTheDocument()
  })

  it('switches to the archive through the status select', async () => {
    await signIn()
    const { onFiltersChange } = renderTable()
    await screen.findByText('Aziza Karimova')

    await userEvent.click(screen.getByRole('combobox', { name: "Holat bo'yicha filtr" }))
    await userEvent.click(screen.getByRole('option', { name: 'Arxivda' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ ...filters, archived: true, page: 1 })
  })

  it('filters by the doctor id, never by a name', async () => {
    await signIn()
    const { onFiltersChange } = renderTable()
    await screen.findByText('Aziza Karimova')

    await userEvent.click(screen.getByRole('combobox', { name: "Shifokor bo'yicha filtr" }))
    await userEvent.click(await screen.findByRole('option', { name: 'Sardor Usmonov' }))

    expect(onFiltersChange).toHaveBeenCalledWith({ ...filters, doctorId: mockId(4, 4), page: 1 })
  })

  it('hides the create button from a user without permission', async () => {
    // The all-branches view is read-only: a patient is registered in one branch.
    await signIn('owner', 'all')
    renderTable()

    await screen.findByText('Aziza Karimova')
    expect(screen.queryByRole('button', { name: "Bemor qo'shish" })).not.toBeInTheDocument()
  })
})
