import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { httpClient } from '@/shared/api/httpClient'
import { MOCK_USERS, mockId } from '@/shared/api/mocks/fixtures'
import { server } from '@/shared/api/mocks/server'
import { signInAs, signOut } from '@/shared/api/mocks/signIn'
import { clinicNow } from '@/shared/lib/datetime'
import { rangeOf } from '@/shared/lib/report'
import {
  expenseKeys,
  fetchCompensationHistory,
  fetchDueMonth,
  fetchExpenseSummary,
  fetchExpenses,
  fetchMyEarnings,
  fetchPayroll,
} from './queries'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  signOut()
})
afterAll(() => server.close())

const DOCTOR = MOCK_USERS.doctor.memberships[0].id
// The seeded filling's patient.
const MOCK_PATIENT = mockId(7, 1)
const today = () => clinicNow().date
const thisMonth = () => today().slice(0, 7)

function post(url: string, body: Record<string, unknown>) {
  return httpClient<{ id: string }>(url, { method: 'POST', body: JSON.stringify(body) })
}

function expense(fields: Record<string, unknown> = {}) {
  return post('v1/expenses/', {
    spent_on: today(),
    category: 'rent',
    amount: 1_230_000,
    method: 'transfer',
    payee: 'Landlord',
    notes: '',
    doctor: null,
    ...fields,
  })
}

describe('expenseKeys', () => {
  it('puts the clinic inside every key', () => {
    const range = rangeOf('week', '2026-10-19')
    const filters = { from: range.from, to: range.to, category: null, page: 1 }

    expect(expenseKeys.summary('clinic:a', range)).toEqual([
      'clinics',
      'clinic:a',
      'expenses',
      'summary',
      range,
    ])
    expect(expenseKeys.list('clinic:a', filters)).not.toEqual(expenseKeys.list('clinic:b', filters))
    expect(expenseKeys.payroll('clinic:a', '2026-10').slice(0, 3)).toEqual(
      expenseKeys.scope('clinic:a'),
    )
  })
})

describe('expenses', () => {
  beforeEach(() => signInAs('owner'))

  it('counts a new entry in the journal and the summary, and stops counting it once voided', async () => {
    const range = rangeOf('week', today())
    const created = await expense()

    const page = await fetchExpenses({ from: range.from, to: range.to, category: null, page: 1 })
    expect(page.results[0]).toMatchObject({
      id: created.id,
      amount: 1_230_000,
      category: 'rent',
      payee: 'Landlord',
      note: null,
      isVoid: false,
    })
    const summary = await fetchExpenseSummary(range)
    expect(summary.totals).toMatchObject({ total: 1_230_000, count: 1, fixed: 1_230_000 })

    await post(`v1/expenses/${created.id}/void/`, { reason: 'Ikki marta kiritilgan' })
    expect((await fetchExpenseSummary(range)).totals.total).toBe(0)
    const voided = await fetchExpenses({ from: range.from, to: range.to, category: null, page: 1 })
    expect(voided.results[0]).toMatchObject({ isVoid: true, voidReason: 'Ikki marta kiritilgan' })
  })

  it('filters by category', async () => {
    const range = rangeOf('week', today())
    await expense()
    await expense({ category: 'materials', amount: 50_000 })

    const page = await fetchExpenses({
      from: range.from,
      to: range.to,
      category: 'materials',
      page: 1,
    })
    expect(page.results.map((row) => row.category)).toEqual(['materials'])
  })

  it("keeps pay rows from a branch admin's journal", async () => {
    const range = rangeOf('week', today())
    await expense({ category: 'doctor_share', amount: 400_000, doctor: DOCTOR })
    await expense({ category: 'materials', amount: 50_000 })

    signInAs('admin')
    const page = await fetchExpenses({ from: range.from, to: range.to, category: null, page: 1 })
    expect(page.results.map((row) => row.category)).toEqual(['materials'])
    expect((await fetchExpenseSummary(range)).totals.payroll).toBe(0)
  })
})

describe('recurring expenses', () => {
  beforeEach(() => signInAs('owner'))

  async function template() {
    return post('v1/recurring-expenses/', {
      name: 'Bino ijarasi',
      category: 'rent',
      amount: 12_000_000,
      method: 'transfer',
      payee: 'Landlord',
      day_of_month: 5,
    })
  }

  it('posts a payment as an expense, once per month', async () => {
    const { id } = await template()
    const month = thisMonth()

    const due = await fetchDueMonth(month)
    expect(due.items).toHaveLength(1)
    expect(due.totals).toEqual({ expected: 12_000_000, paid: 0, remaining: 12_000_000 })

    const paid = await post(`v1/recurring-expenses/${id}/pay/`, {
      month,
      spent_on: today(),
      amount: 11_500_000,
      method: 'cash',
      notes: '',
    })
    const after = await fetchDueMonth(month)
    expect(after.items[0]).toMatchObject({
      status: 'paid',
      paidAmount: 11_500_000,
      expenseId: paid.id,
    })
    await expect(
      post(`v1/recurring-expenses/${id}/pay/`, { month, amount: 1, method: 'cash' }),
    ).rejects.toMatchObject({ kind: 'validation' })
  })

  it('leaves a skipped month out of what is expected', async () => {
    const { id } = await template()
    const month = thisMonth()

    await post(`v1/recurring-expenses/${id}/skip/`, { month, reason: 'Ta’mir' })
    const due = await fetchDueMonth(month)
    expect(due.items[0]).toMatchObject({ status: 'skipped', skipReason: 'Ta’mir' })
    expect(due.totals.expected).toBe(0)
  })
})

describe('payroll', () => {
  beforeEach(() => signInAs('owner'))

  it('accrues nothing without terms, then pays what the terms earn', async () => {
    const month = thisMonth()
    const before = (await fetchPayroll(month)).rows.find((row) => row.doctorId === DOCTOR)
    expect(before).toMatchObject({ compensation: null, accrued: 0, balance: 0 })

    await post('v1/compensations/', {
      doctor: DOCTOR,
      percent: 0,
      fixed: 3_000_000,
      base: 'collected',
      effective_from: month,
    })
    const owed = (await fetchPayroll(month)).rows.find((row) => row.doctorId === DOCTOR)
    expect(owed).toMatchObject({ accrued: 3_000_000, balance: 3_000_000 })
    expect(owed?.compensation).toMatchObject({ fixed: 3_000_000, effectiveFrom: month })

    await post('v1/payroll/pay/', {
      doctor: DOCTOR,
      month,
      amount: 3_000_000,
      method: 'cash',
      spent_on: today(),
      notes: '',
    })
    const settled = (await fetchPayroll(month)).rows.find((row) => row.doctorId === DOCTOR)
    expect(settled).toMatchObject({ paid: 3_000_000, balance: 0 })

    const history = await fetchCompensationHistory(DOCTOR)
    expect(history).toHaveLength(1)
  })

  it('is refused to a branch admin', async () => {
    signInAs('admin')
    await expect(fetchPayroll(thisMonth())).rejects.toMatchObject({ kind: 'forbidden' })
  })
})

describe('my earnings', () => {
  // The seed: a 350,000 filling on 10 Aug 2026, of which the patient paid 150,000.
  const august = '2026-08'

  beforeEach(async () => {
    signInAs('owner')
    await post('v1/compensations/', {
      doctor: DOCTOR,
      percent: 40,
      fixed: 0,
      base: 'collected',
      effective_from: august,
    })
  })

  it('splits the month into earned and still waiting on the patient', async () => {
    const row = (await fetchPayroll(august)).rows.find((entry) => entry.doctorId === DOCTOR)
    expect(row).toMatchObject({ accrued: 60_000, pending: 200_000, pendingShare: 80_000 })

    signInAs('doctor')
    const mine = await fetchMyEarnings(august)
    expect(mine.summary).toMatchObject({ doctorId: DOCTOR, accrued: 60_000, pendingShare: 80_000 })
    expect(mine.lines).toEqual([
      expect.objectContaining({
        patientName: 'Aziza Karimova',
        total: 350_000,
        paid: 150_000,
        unpaid: 200_000,
        status: 'in_progress',
      }),
    ])
  })

  it('carries unpaid work forward until the patient pays it off', async () => {
    signInAs('doctor')
    const owed = await fetchMyEarnings(thisMonth())
    expect(owed.lines.map((line) => line.status)).toEqual(['in_progress'])

    signInAs('owner')
    await post('v1/payments/', { patient: MOCK_PATIENT, amount: 200_000, method: 'cash' })
    signInAs('doctor')
    // Settled this month, so August's filling no longer waits on anyone.
    expect((await fetchMyEarnings(thisMonth())).lines).toEqual([])
  })

  it("is the doctor's own: the owner and the desk read pay elsewhere", async () => {
    await expect(fetchMyEarnings(august)).rejects.toMatchObject({ kind: 'forbidden' })
    signInAs('admin')
    await expect(fetchMyEarnings(august)).rejects.toMatchObject({ kind: 'forbidden' })
  })
})
