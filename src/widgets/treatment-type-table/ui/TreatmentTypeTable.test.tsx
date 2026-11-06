import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { TreatmentTypeTable } from './TreatmentTypeTable'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <TreatmentTypeTable clinicId="clinic:test" />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )
}

describe('TreatmentTypeTable', () => {
  beforeEach(() => signInAs('admin'))

  it('opens with "Barchasi" shown, not a blank select', async () => {
    renderTable()

    // Radix `Select` treats `""` as "no selection, show the placeholder" no
    // matter what — the filter's "all" option must use a different sentinel,
    // or this combobox renders empty on first paint.
    await screen.findByText('Implantatsiya')
    expect(
      screen.getByRole('combobox', { name: "Shifokor turi bo'yicha filtr" }),
    ).toHaveTextContent('Barchasi')
  })

  it('filters to one doctor type and back to all', async () => {
    renderTable()
    await screen.findByText('Implantatsiya')

    const select = screen.getByRole('combobox', { name: "Shifokor turi bo'yicha filtr" })
    await userEvent.click(select)
    await userEvent.click(screen.getByRole('option', { name: 'Stomatolog' }))

    expect(screen.getByText('Plomba')).toBeInTheDocument()
    expect(screen.queryByText('Tozalash')).not.toBeInTheDocument()
    expect(screen.queryByText('Implantatsiya')).not.toBeInTheDocument()

    // The regression this covers: with "" as the sentinel, Select's own
    // native-bubble guard silently swallowed the switch back to "all".
    await userEvent.click(select)
    await userEvent.click(screen.getByRole('option', { name: 'Barchasi' }))

    expect(select).toHaveTextContent('Barchasi')
    expect(screen.getByText('Tozalash')).toBeInTheDocument()
    expect(screen.getByText('Implantatsiya')).toBeInTheDocument()
  })

  it('filters to services with no doctor type assigned', async () => {
    renderTable()
    await screen.findByText('Implantatsiya')

    const select = screen.getByRole('combobox', { name: "Shifokor turi bo'yicha filtr" })
    await userEvent.click(select)
    await userEvent.click(screen.getByRole('option', { name: 'Tayinlanmagan' }))

    expect(screen.getByText('Implantatsiya')).toBeInTheDocument()
    expect(screen.queryByText('Plomba')).not.toBeInTheDocument()
  })

  it('shows a message rather than an empty table when nothing matches', async () => {
    // No fixture service is filed under the orthodontist.
    renderTable()
    await screen.findByText('Implantatsiya')

    const select = screen.getByRole('combobox', { name: "Shifokor turi bo'yicha filtr" })
    await userEvent.click(select)
    await userEvent.click(screen.getByRole('option', { name: 'Ortodont' }))

    expect(screen.getByText('Bu turdagi xizmat topilmadi')).toBeInTheDocument()
    expect(screen.queryByText('Implantatsiya')).not.toBeInTheDocument()
  })

  it('shows "so\'m", not the ISO currency code', async () => {
    renderTable()

    const row = (await screen.findByText('Implantatsiya')).closest('tr')
    if (row === null) throw new Error('row not found')
    expect(within(row).getByText(/so'm/)).toBeInTheDocument()
    expect(within(row).queryByText(/UZS/)).not.toBeInTheDocument()
  })
})
