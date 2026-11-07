import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { httpClient } from '@/shared/api/httpClient'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { rangeOf } from '@/shared/lib/report'
import { fetchFinanceOverview, financeKeys } from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

describe('financeKeys', () => {
  it('puts the clinic inside every key', () => {
    const range = rangeOf('week', '2026-10-19')
    expect(financeKeys.overview('clinic:a', range)).toEqual([
      'clinics',
      'clinic:a',
      'finance',
      'overview',
      range,
    ])
    expect(financeKeys.overview('clinic:a', range)).not.toEqual(
      financeKeys.overview('clinic:b', range),
    )
  })
})

describe('fetchFinanceOverview', () => {
  // The seed's procedure and payment are on 2026-08-10.
  const august = { from: '2026-08-01', to: '2026-08-31', bucket: 'day' as const }

  beforeEach(() => signInAs('owner'))

  it('reads income, debt and profit with money parsed from decimal strings', async () => {
    await httpClient('v1/expenses/', {
      method: 'POST',
      body: JSON.stringify({
        spent_on: '2026-08-12',
        category: 'materials',
        amount: 20_000,
        method: 'cash',
        payee: '',
        notes: '',
        doctor: null,
      }),
    })
    const overview = await fetchFinanceOverview(august)

    expect(overview.totals).toMatchObject({
      billed: 350_000,
      collected: 150_000,
      expenses: 20_000,
      profit: 130_000,
      outstandingDebt: 200_000,
      debtorsCount: 1,
    })
    expect(overview.includesPayroll).toBe(true)
    expect(overview.paymentMethods).toEqual([{ method: 'cash', amount: 150_000 }])
  })

  it('leaves profit out for a viewer who may not see pay', async () => {
    signInAs('admin')
    const overview = await fetchFinanceOverview(august)

    expect(overview.includesPayroll).toBe(false)
    expect(overview.totals.profit).toBeNull()
  })

  it('is refused to a doctor', async () => {
    signInAs('doctor')
    await expect(fetchFinanceOverview(august)).rejects.toMatchObject({ kind: 'forbidden' })
  })
})
