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

const percentNumber = (value: string): number => Number(value.replace(',', '.') || 0)

/**
 * A doctor's pay agreement: a monthly salary, a percent of their work, or both.
 *
 * Each half has its own switch, because clinics agree one, the other or both and
 * the form should say which, rather than read meaning into an empty input. A
 * switched-on half needs a value above zero; both off means "no terms yet".
 */
export const payTermsSchema = v.pipe(
  v.object({
    percentOn: v.boolean(),
    /** Text, so "32,5" typed on a Russian keyboard reads as 32.5. */
    percent: v.pipe(
      v.string(),
      v.trim(),
      v.check(
        (value) => value === '' || (PERCENT.test(value) && percentNumber(value) <= 100),
        'validation.invalid',
      ),
    ),
    fixedOn: v.boolean(),
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
  }),
  v.forward(
    v.partialCheck(
      [['percentOn'], ['percent']],
      (input) => !input.percentOn || percentNumber(input.percent) > 0,
      'validation.required',
    ),
    ['percent'],
  ),
  v.forward(
    v.partialCheck(
      [['fixedOn'], ['fixed']],
      (input) => !input.fixedOn || Number(input.fixed || 0) > 0,
      'validation.required',
    ),
    ['fixed'],
  ),
)

export type PayTermsInput = v.InferOutput<typeof payTermsSchema>

/** What the form needs from existing terms: a `Compensation` or a staff row's current terms. */
export type PayTermsSource = Pick<Compensation, 'percent' | 'fixed' | 'base'>

export const emptyPayTerms: PayTermsInput = {
  percentOn: false,
  percent: '',
  fixedOn: false,
  fixed: '',
  base: 'collected',
}

export function toPayTerms(current: PayTermsSource | null): PayTermsInput {
  if (current === null) return emptyPayTerms
  return {
    percentOn: current.percent > 0,
    percent: current.percent === 0 ? '' : String(current.percent),
    fixedOn: current.fixed > 0,
    fixed: current.fixed === 0 ? '' : String(current.fixed),
    base: current.base,
  }
}

export interface PayTermsPayload {
  percent: number
  fixed: number
  base: CompensationBase
}

/** `null` when both halves are off: there is nothing to agree yet. */
export function toPayTermsPayload(input: PayTermsInput): PayTermsPayload | null {
  if (!input.percentOn && !input.fixedOn) return null
  return {
    // A switched-off half is sent as 0, whatever is still typed in it.
    percent: input.percentOn ? percentNumber(input.percent) : 0,
    fixed: input.fixedOn ? Number(input.fixed || 0) : 0,
    base: input.base,
  }
}

/** New terms for an existing doctor, from a month on. Unlike hiring, "none" is not a change. */
export const compensationFormSchema = v.pipe(
  v.object({
    pay: payTermsSchema,
    effectiveFrom: v.pipe(v.string(), v.regex(CALENDAR_MONTH, 'validation.invalid')),
  }),
  v.forward(
    v.partialCheck(
      [
        ['pay', 'percentOn'],
        ['pay', 'fixedOn'],
      ],
      (input) => input.pay.percentOn || input.pay.fixedOn,
      'validation.required',
    ),
    ['pay', 'percent'],
  ),
)

export type CompensationFormInput = v.InferOutput<typeof compensationFormSchema>

/** The current terms as the starting point, from the given month on. */
export function toCompensationForm(
  current: PayTermsSource | null,
  effectiveFrom: string,
): CompensationFormInput {
  return { pay: toPayTerms(current), effectiveFrom }
}

export interface CompensationPayload extends PayTermsPayload {
  effective_from: string
}

export function toCompensationPayload(input: CompensationFormInput): CompensationPayload {
  // The schema refuses both halves off, so the fallback is never sent.
  const pay = toPayTermsPayload(input.pay) ?? { percent: 0, fixed: 0, base: input.pay.base }
  return { ...pay, effective_from: input.effectiveFrom }
}

type CompensationField = 'pay.percent' | 'pay.fixed' | 'pay.base' | 'effectiveFrom'

const COMPENSATION_SERVER_FIELDS: Record<string, CompensationField> = {
  percent: 'pay.percent',
  fixed: 'pay.fixed',
  base: 'pay.base',
  effective_from: 'effectiveFrom',
}

export function compensationFormFieldOf(serverField: string): CompensationField | 'root' {
  return COMPENSATION_SERVER_FIELDS[serverField] ?? 'root'
}
