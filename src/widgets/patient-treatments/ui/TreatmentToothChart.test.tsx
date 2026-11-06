import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Suspense } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_PATIENTS, MOCK_PROCEDURES, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { createI18n } from '@/shared/i18n'
import { TreatmentToothChart } from './TreatmentToothChart'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const row = (n: number, tooth: number, name: string, performedAt: string, voided = false) => ({
  ...MOCK_PROCEDURES[0],
  id: mockId(9, n),
  tooth,
  service_name: name,
  performed_at: performedAt,
  voided_at: voided ? '2026-09-02T06:00:00Z' : null,
})

/** Tooth 16: two procedures. Tooth 21: one. Tooth 26: only a voided line. */
const ROWS = [
  row(1, 16, 'Plomba', '2026-08-01T06:00:00Z'),
  row(2, 16, 'Эндо Тиадент', '2026-09-01T06:00:00Z'),
  row(3, 21, 'Tozalash', '2026-07-01T06:00:00Z'),
  row(4, 26, 'Plomba', '2026-09-01T06:00:00Z', true),
]

function renderChart() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={createI18n('uz-Latn')}>
        <Suspense fallback={null}>
          <TreatmentToothChart
            clinicId="clinic:test"
            onVoid={vi.fn()}
            patientId={MOCK_PATIENTS[0]?.id ?? ''}
          />
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>,
  )

  return { container }
}

const tooth = (container: HTMLElement, fdi: string) =>
  container.querySelector<SVGGElement>(`[data-fdi="${fdi}"]`) as SVGGElement

describe('TreatmentToothChart', () => {
  beforeEach(() => {
    signInAs('admin')
    server.use(
      http.get('/api/v1/procedures/', () =>
        HttpResponse.json({ count: ROWS.length, next: null, previous: null, results: ROWS }),
      ),
    )
  })

  it('marks every tooth with recorded work, and none for a voided line', async () => {
    const { container } = renderChart()

    expect(await screen.findByText('Davolangan')).toBeInTheDocument()
    expect(tooth(container, '16')).toHaveAttribute('data-status', 'done')
    expect(tooth(container, '21')).toHaveAttribute('data-status', 'done')
    expect(tooth(container, '26')).toHaveAttribute('data-status', 'none')
    expect(tooth(container, '11')).toHaveAttribute('data-status', 'none')
  })

  it("shows the tooth's services on hover, and nothing on an untreated tooth", async () => {
    const { container } = renderChart()
    await screen.findByText('Davolangan')

    await userEvent.hover(tooth(container, '16'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tish 16')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Plomba, Эндо Тиадент')

    await userEvent.unhover(tooth(container, '16'))
    await userEvent.hover(tooth(container, '11'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it("opens the tooth's latest procedure on click, and nothing for an untreated one", async () => {
    const { container } = renderChart()
    await screen.findByText('Davolangan')

    await userEvent.click(tooth(container, '11'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(tooth(container, '16'))
    const dialog = await screen.findByRole('dialog', { name: "Muolaja ma'lumotlari" })
    expect(dialog).toHaveTextContent('Эндо Тиадент')
  })
})
