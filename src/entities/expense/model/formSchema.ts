import * as v from 'valibot'
import { parseCalendarDate } from '@/shared/lib/calendarDate'
import { CALENDAR_MONTH } from '@/shared/lib/calendarMonth'
import { clinicNow } from '@/shared/lib/datetime'
import {
  COMPENSATION_BASES,
  type Compensation,
  type CompensationBase,
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  type ExpenseCategory,
  type ExpenseMethod,
  RECURRING_CATEGORIES,
  type RecurringCategory,
  type RecurringExpense,
} from './types'

/**
 * The writable shape of an expense. In the entity rather than a feature, so
 * create and edit share one definition without importing each other (§4).
 */

/** Digits only. Money is entered as whole so'm — no separators, no decimals. */
const DIGITS = /^\d+$/

/**
 * Above this a typo is far likelier than a real payment (an extra zero on rent).
 * The server keeps its own limit; this one only saves a round trip.
 */
export const EXPENSE_AMOUNT_MAX = 10_000_000_000

const PAYEE_MAX = 120
const NOTE_MAX = 255

const paidDateSchema = v.pipe(
  v.string(),
  v.minLength(1, 'validation.required'),
  v.check((value) => parseCalendarDate(value) !== null, 'validation.invalid'),
  // A payment that has not happened yet is not an expense. The clinic's
  // day, not the browser's (§14): before 05:00 the UTC day is yesterday.
  v.check((value) => value <= clinicNow().date, 'validation.futureDate'),
)

const amountSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'validation.required'),
  v.check((value) => DIGITS.test(value) && Number(value) > 0, 'validation.invalid'),
  v.check((value) => Number(value) <= EXPENSE_AMOUNT_MAX, 'validation.tooLarge'),
)

const payeeSchema = v.pipe(v.string(), v.trim(), v.maxLength(PAYEE_MAX, 'validation.max_length'))
const noteSchema = v.pipe(v.string(), v.trim(), v.maxLength(NOTE_MAX, 'validation.max_length'))

export const expenseFormSchema = v.pipe(
  v.object({
    date: paidDateSchema,
    category: v.pipe(
      v.picklist(['', ...EXPENSE_CATEGORIES]),
      v.check((value) => value !== '', 'validation.required'),
    ),
    amount: amountSchema,
    method: v.picklist(EXPENSE_METHODS),
    payee: payeeSchema,
    note: noteSchema,
    /** An `entities/doctor` id as a string; `''` when the category is not a doctor's share. */
    doctorId: v.string(),
  }),
  v.forward(
    v.partialCheck(
      [['category'], ['doctorId']],
      (input) => input.category !== 'doctor_share' || input.doctorId !== '',
      'validation.required',
    ),
    ['doctorId'],
  ),
)

export type ExpenseFormInput = v.InferOutput<typeof expenseFormSchema>

export function emptyExpenseForm(): ExpenseFormInput {
  return {
    date: clinicNow().date,
    category: '',
    amount: '',
    method: 'cash',
    payee: '',
    note: '',
    doctorId: '',
  }
}

export interface ExpensePayload {
  spent_on: string
  category: ExpenseCategory
  amount: number
  method: ExpenseMethod
  payee: string
  notes: string
  doctor: string | null
}

/** Only call with a validated form: `category` is non-empty by then. */
export function toExpensePayload(input: ExpenseFormInput): ExpensePayload {
  const category = input.category === '' ? 'other' : input.category
  return {
    spent_on: input.date,
    category,
    amount: Number(input.amount),
    method: input.method,
    payee: input.payee,
    notes: input.note,
    // A doctor left over from switching category away is not sent.
    doctor: category === 'doctor_share' && input.doctorId !== '' ? input.doctorId : null,
  }
}

const SERVER_FIELD_NAMES: Record<string, keyof ExpenseFormInput> = {
  spent_on: 'date',
  category: 'category',
  amount: 'amount',
  method: 'method',
  payee: 'payee',
  notes: 'note',
  doctor: 'doctorId',
}

/** The inverse, for putting a server error back on the input that caused it (§10). */
export function expenseFormFieldOf(serverField: string): keyof ExpenseFormInput | 'root' {
  return SERVER_FIELD_NAMES[serverField] ?? 'root'
}

/** Why an entry is being voided — required, so the journal can answer "what happened here?". */
export const voidExpenseFormSchema = v.object({
  reason: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(3, 'validation.tooShort'),
    v.maxLength(200, 'validation.max_length'),
  ),
})

export type VoidExpenseFormInput = v.InferOutput<typeof voidExpenseFormSchema>

/** The writable shape of a recurring template. */
export const recurringFormSchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(2, 'validation.tooShort'),
    v.maxLength(80, 'validation.max_length'),
  ),
  category: v.pipe(
    v.picklist(['', ...RECURRING_CATEGORIES]),
    v.check((value) => value !== '', 'validation.required'),
  ),
  amount: amountSchema,
  method: v.picklist(EXPENSE_METHODS),
  payee: payeeSchema,
  /** `'1'`–`'28'`: a select's value. Past 28 some months would have no such day. */
  dayOfMonth: v.pipe(
    v.string(),
    v.check(
      (value) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 28,
      'validation.invalid',
    ),
  ),
})

export type RecurringFormInput = v.InferOutput<typeof recurringFormSchema>

export const emptyRecurringForm: RecurringFormInput = {
  name: '',
  category: '',
  amount: '',
  method: 'transfer',
  payee: '',
  dayOfMonth: '5',
}

export function toRecurringForm(template: RecurringExpense): RecurringFormInput {
  return {
    name: template.name,
    category: template.category,
    amount: String(template.amount),
    method: template.method,
    payee: template.payee ?? '',
    dayOfMonth: String(template.dayOfMonth),
  }
}

export interface RecurringPayload {
  name: string
  category: RecurringCategory
  amount: number
  method: ExpenseMethod
  payee: string
  day_of_month: number
}

/** Only call with a validated form: `category` is non-empty by then. */
export function toRecurringPayload(input: RecurringFormInput): RecurringPayload {
  return {
    name: input.name,
    category: input.category === '' ? 'other' : input.category,
    amount: Number(input.amount),
    method: input.method,
    payee: input.payee,
    day_of_month: Number(input.dayOfMonth),
  }
}

const RECURRING_SERVER_FIELDS: Record<string, keyof RecurringFormInput> = {
  name: 'name',
  category: 'category',
  amount: 'amount',
  method: 'method',
  payee: 'payee',
  day_of_month: 'dayOfMonth',
}

export function recurringFormFieldOf(serverField: string): keyof RecurringFormInput | 'root' {
  return RECURRING_SERVER_FIELDS[serverField] ?? 'root'
}

/** Paying one month of a template: what really left the clinic, and when. */
export const payDueFormSchema = v.object({
  date: paidDateSchema,
  amount: amountSchema,
  method: v.picklist(EXPENSE_METHODS),
  note: noteSchema,
})

export type PayDueFormInput = v.InferOutput<typeof payDueFormSchema>

export interface PayDuePayload {
  month: string
  spent_on: string
  amount: number
  method: ExpenseMethod
  notes: string
}

export function toPayDuePayload(month: string, input: PayDueFormInput): PayDuePayload {
  return {
    month,
    spent_on: input.date,
    amount: Number(input.amount),
    method: input.method,
    notes: input.note,
  }
}

const PAY_SERVER_FIELDS: Record<string, keyof PayDueFormInput> = {
  spent_on: 'date',
  amount: 'amount',
  method: 'method',
  notes: 'note',
}

export function payDueFormFieldOf(serverField: string): keyof PayDueFormInput | 'root' {
  return PAY_SERVER_FIELDS[serverField] ?? 'root'
}

const PERCENT = /^\d{1,3}([.,]\d{1,2})?$/

/** A doctor's new pay terms. A percent, a fixed salary, or both — never neither. */
export const compensationFormSchema = v.pipe(
  v.object({
    /** Text, so "32,5" typed on a Russian keyboard reads as 32.5. */
    percent: v.pipe(
      v.string(),
      v.trim(),
      v.check(
        (value) => value === '' || (PERCENT.test(value) && Number(value.replace(',', '.')) <= 100),
        'validation.invalid',
      ),
    ),
    fixed: v.pipe(
      v.string(),
      v.trim(),
      v.check((value) => value === '' || DIGITS.test(value), 'validation.invalid'),
      v.check(
        (value) => value === '' || Number(value) <= EXPENSE_AMOUNT_MAX,
        'validation.tooLarge',
      ),
    ),
    base: v.picklist(COMPENSATION_BASES),
    effectiveFrom: v.pipe(v.string(), v.regex(CALENDAR_MONTH, 'validation.invalid')),
  }),
  v.forward(
    v.partialCheck(
      [['percent'], ['fixed']],
      (input) => Number(input.percent.replace(',', '.') || 0) > 0 || Number(input.fixed || 0) > 0,
      'validation.required',
    ),
    ['percent'],
  ),
)

export type CompensationFormInput = v.InferOutput<typeof compensationFormSchema>

/** The current terms as the starting point, from the given month on. */
export function toCompensationForm(
  current: Compensation | null,
  effectiveFrom: string,
): CompensationFormInput {
  return {
    percent: current === null || current.percent === 0 ? '' : String(current.percent),
    fixed: current === null || current.fixed === 0 ? '' : String(current.fixed),
    base: current?.base ?? 'collected',
    effectiveFrom,
  }
}

export interface CompensationPayload {
  percent: number
  fixed: number
  base: CompensationBase
  effective_from: string
}

export function toCompensationPayload(input: CompensationFormInput): CompensationPayload {
  return {
    percent: Number(input.percent.replace(',', '.') || 0),
    fixed: Number(input.fixed || 0),
    base: input.base,
    effective_from: input.effectiveFrom,
  }
}

const COMPENSATION_SERVER_FIELDS: Record<string, keyof CompensationFormInput> = {
  percent: 'percent',
  fixed: 'fixed',
  base: 'base',
  effective_from: 'effectiveFrom',
}

export function compensationFormFieldOf(serverField: string): keyof CompensationFormInput | 'root' {
  return COMPENSATION_SERVER_FIELDS[serverField] ?? 'root'
}
