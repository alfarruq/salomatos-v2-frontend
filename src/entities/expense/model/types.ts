import type { CalendarDate } from '@/shared/lib/calendarDate'
import type { CalendarMonth } from '@/shared/lib/calendarMonth'
import type { ReportRange } from '@/shared/lib/report'

/**
 * `apps.finance.models.Category`. Clinic-defined categories may come later, so
 * readers already tolerate an unknown value (see `schema.ts`).
 */
export const EXPENSE_CATEGORIES = [
  'doctor_share',
  'staff_salary',
  'rent',
  'utilities',
  'communication',
  'materials',
  'lab',
  'equipment',
  'marketing',
  'taxes_fees',
  'other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/**
 * The three questions an owner asks of their costs: what people cost, what is
 * owed every month whether or not a patient comes, and what moves with the work.
 */
export type ExpenseKind = 'payroll' | 'fixed' | 'variable'

export const EXPENSE_CATEGORY_KIND: Record<ExpenseCategory, ExpenseKind> = {
  doctor_share: 'payroll',
  staff_salary: 'payroll',
  rent: 'fixed',
  utilities: 'fixed',
  communication: 'fixed',
  taxes_fees: 'fixed',
  materials: 'variable',
  lab: 'variable',
  equipment: 'variable',
  marketing: 'variable',
  other: 'variable',
}

/** How money left the clinic. Narrower than `PaymentMethod`: nobody pays rent with Payme. */
export const EXPENSE_METHODS = ['cash', 'card', 'transfer'] as const

export type ExpenseMethod = (typeof EXPENSE_METHODS)[number]

/**
 * One payment the clinic made, entered by hand (`ExpenseSerializer`).
 *
 * Never edited or deleted: a mistaken entry is voided with a reason, stays in
 * the journal and drops out of every total. No patient data belongs here (§3).
 */
export interface Expense {
  id: string
  clinicName: string
  date: CalendarDate
  category: ExpenseCategory
  amount: number
  method: ExpenseMethod
  /** Who was paid: a landlord, a supplier, a utility. */
  payee: string | null
  note: string | null
  /** Set for `doctor_share` only. */
  doctorId: string | null
  doctorName: string | null
  /** The month a doctor's share or a recurring slot settles. */
  period: CalendarMonth | null
  isVoid: boolean
  voidReason: string | null
  /** The staff member who entered it, as the server recorded. */
  createdBy: string | null
  /** The recurring template this payment settled, if it came from one. */
  recurringId: string | null
}

export interface ExpenseFilters {
  from: CalendarDate
  to: CalendarDate
  category: ExpenseCategory | null
  page: number
}

export interface ExpensePage {
  count: number
  hasNext: boolean
  hasPrevious: boolean
  results: Expense[]
}

/** The server's own sums, voided entries excluded. The browser never adds money up. */
export interface ExpenseTotals {
  total: number
  count: number
  payroll: number
  fixed: number
  variable: number
}

export interface ExpenseSummary {
  range: ReportRange
  totals: ExpenseTotals
  previousTotals: ExpenseTotals | null
  byCategory: { category: ExpenseCategory; amount: number }[]
  series: { start: CalendarDate; amount: number }[]
}

/**
 * Categories a recurring template may use. A doctor's share is computed from
 * the money they bring in, so it never repeats at a fixed amount.
 */
export const RECURRING_CATEGORIES = EXPENSE_CATEGORIES.filter(
  (category): category is Exclude<ExpenseCategory, 'doctor_share'> => category !== 'doctor_share',
)

export type RecurringCategory = Exclude<ExpenseCategory, 'doctor_share'>

/**
 * A payment the clinic owes every month: rent, a utility, a salary. Only a
 * reminder: each month's payment is still entered by hand, at its real amount.
 * Never deleted, only switched off, so past months keep their history.
 */
export interface RecurringExpense {
  id: string
  clinicName: string
  name: string
  category: RecurringCategory
  /** The usual amount; the real one is entered when it is paid. */
  amount: number
  method: ExpenseMethod
  payee: string | null
  /** 1–28, so every month has the day. */
  dayOfMonth: number
  isActive: boolean
}

export type DueStatus = 'due' | 'overdue' | 'paid' | 'skipped'

/** One template's slot in one month. */
export interface DueExpense {
  recurringId: string
  name: string
  category: RecurringCategory
  amount: number
  method: ExpenseMethod
  payee: string | null
  dueDate: CalendarDate
  status: DueStatus
  /** Set once paid: the expense that settled it, and what was actually paid. */
  expenseId: string | null
  paidAmount: number | null
  paidDate: CalendarDate | null
  skipReason: string | null
}

/** `yyyy-MM`. */
export type { CalendarMonth }

export interface DueMonth {
  month: CalendarMonth
  /** The server's sums, never the browser's. */
  totals: { expected: number; paid: number; remaining: number }
  items: DueExpense[]
}

/** What a doctor's percent is taken from. Collected is the default: no share of unpaid debt. */
export const COMPENSATION_BASES = ['collected', 'billed'] as const

export type CompensationBase = (typeof COMPENSATION_BASES)[number]

/**
 * A doctor's pay terms from one month on. A change is a new entry, never an
 * edit, so months already settled keep the terms they were settled under.
 */
export interface Compensation {
  id: string
  doctorId: string
  /** 0–100; may be fractional, e.g. 32.5. */
  percent: number
  /** Fixed monthly salary in so'm, 0 when the doctor is on percent only. */
  fixed: number
  base: CompensationBase
  effectiveFrom: CalendarMonth
  createdBy: string | null
}

/** One doctor's month, as the server computes it. The browser never adds money up. */
export interface PayrollRow {
  doctorId: string
  doctorName: string
  clinicName: string
  /** A deactivated doctor still shows while money is owed either way. */
  isActive: boolean
  /** `null`: no terms set yet, so nothing is accrued. */
  compensation: Compensation | null
  collected: number
  billed: number
  /** What the percent is taken from: collected or billed. */
  baseAmount: number
  accrued: number
  /** Owed (or overpaid, when negative) from earlier months. */
  opening: number
  paid: number
  /** `opening + accrued − paid`. */
  balance: number
}

export interface Payroll {
  month: CalendarMonth
  rows: PayrollRow[]
  totals: { accrued: number; paid: number; balance: number }
}
