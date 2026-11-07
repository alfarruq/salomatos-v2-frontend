import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { clinicNow } from '@/shared/lib/datetime'
import { addDays } from '@/shared/lib/report'
import {
  compensationFormSchema,
  emptyExpenseForm,
  emptyRecurringForm,
  expenseFormSchema,
  recurringFormSchema,
  toCompensationPayload,
  toExpensePayload,
  toRecurringPayload,
} from './formSchema'

const valid = { ...emptyExpenseForm(), category: 'rent' as const, amount: '12000000' }

function issuesOf(input: unknown): string[] {
  const result = v.safeParse(expenseFormSchema, input)
  return result.success ? [] : result.issues.map((issue) => issue.message)
}

describe('expenseFormSchema', () => {
  it('accepts a complete entry', () => {
    expect(issuesOf(valid)).toEqual([])
  })

  it('refuses a date after the clinic today', () => {
    expect(issuesOf({ ...valid, date: addDays(clinicNow().date, 1) })).toContain(
      'validation.futureDate',
    )
  })

  it('refuses a zero, a typo and an implausible amount', () => {
    expect(issuesOf({ ...valid, amount: '0' })).toContain('validation.invalid')
    expect(issuesOf({ ...valid, amount: '1 200' })).toContain('validation.invalid')
    expect(issuesOf({ ...valid, amount: '99000000000' })).toContain('validation.tooLarge')
  })

  it('requires a doctor for a doctor share only', () => {
    expect(issuesOf({ ...valid, category: 'doctor_share' })).toContain('validation.required')
    expect(issuesOf({ ...valid, category: 'doctor_share', doctorId: '2' })).toEqual([])
  })
})

describe('toExpensePayload', () => {
  it('drops a doctor left over from another category', () => {
    expect(toExpensePayload({ ...valid, doctorId: '2' }).doctor).toBeNull()
    expect(toExpensePayload({ ...valid, category: 'doctor_share', doctorId: '2' }).doctor).toBe('2')
  })

  it('sends the amount as a number and the server field names', () => {
    const payload = toExpensePayload(valid)
    expect(payload.amount).toBe(12_000_000)
    expect(payload.payee).toBe('')
    expect(payload.notes).toBe('')
  })
})

describe('recurringFormSchema', () => {
  const template = {
    ...emptyRecurringForm,
    name: 'Bino ijarasi',
    category: 'rent',
    amount: '12000000',
  }

  it('accepts a template and sends numbers', () => {
    const result = v.safeParse(recurringFormSchema, template)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(toRecurringPayload(result.output)).toMatchObject({
        amount: 12_000_000,
        day_of_month: 5,
      })
    }
  })

  it('keeps the day inside every month and doctor share out of templates', () => {
    expect(v.safeParse(recurringFormSchema, { ...template, dayOfMonth: '31' }).success).toBe(false)
    expect(
      v.safeParse(recurringFormSchema, { ...template, category: 'doctor_share' }).success,
    ).toBe(false)
  })
})

describe('compensationFormSchema', () => {
  const terms = {
    percent: '32,5',
    fixed: '',
    base: 'collected',
    deductLab: true,
    effectiveFrom: '2026-10',
  }

  it('reads a comma decimal and sends numbers', () => {
    const result = v.safeParse(compensationFormSchema, terms)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(toCompensationPayload(result.output)).toMatchObject({ percent: 32.5, fixed: 0 })
    }
  })

  it('needs a percent or a salary, and a percent within 100', () => {
    expect(v.safeParse(compensationFormSchema, { ...terms, percent: '' }).success).toBe(false)
    expect(v.safeParse(compensationFormSchema, { ...terms, percent: '120' }).success).toBe(false)
    expect(
      v.safeParse(compensationFormSchema, { ...terms, percent: '', fixed: '3000000' }).success,
    ).toBe(true)
  })
})
