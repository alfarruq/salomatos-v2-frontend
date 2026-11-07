import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import { CALENDAR_MONTH } from '@/shared/lib/calendarMonth'
import {
  COMPENSATION_BASES,
  type Compensation,
  type DueMonth,
  EARNINGS_STATUSES,
  type Earnings,
  EXPENSE_CATEGORIES,
  EXPENSE_METHODS,
  type Expense,
  type ExpensePage,
  type ExpenseSummary,
  type ExpenseTotals,
  type Payroll,
  type PayrollRow,
  RECURRING_CATEGORIES,
  type RecurringExpense,
} from './types'

/**
 * The wire contract of `apps/finance` on the backend:
 *
 *   GET   /api/v1/expenses/?spent_from&spent_to&category&page   page envelope
 *   POST  /api/v1/expenses/                                     one expense
 *   POST  /api/v1/expenses/{id}/void/  {reason}                 one expense
 *   GET   /api/v1/expenses/summary/?from&to                     sums only
 *
 *   GET   /api/v1/recurring-expenses/                           page envelope
 *   POST  /api/v1/recurring-expenses/                           one template
 *   PATCH /api/v1/recurring-expenses/{id}/                      one template
 *   GET   /api/v1/recurring-expenses/due/?month                 one month's slots
 *   POST  /api/v1/recurring-expenses/{id}/pay/                  the new expense
 *   POST  /api/v1/recurring-expenses/{id}/skip/                 204
 *   POST  /api/v1/recurring-expenses/{id}/unskip/               204
 *
 *   GET   /api/v1/payroll/?month                                one row per doctor
 *   POST  /api/v1/payroll/pay/                                  the new expense
 *   GET   /api/v1/compensations/?doctor                         page, newest first
 *   POST  /api/v1/compensations/                                a new terms entry
 *
 * The server refuses all of them to doctors and keeps pay rows from admins; the
 * frontend gate is UX only (§3).
 */

/** DRF sends `DecimalField` as a string; so'm fit a double exactly. */
const money = v.pipe(
  v.union([v.string(), v.number()]),
  v.transform((value) => Number(value)),
  v.check((value: number) => Number.isFinite(value)),
)
const id = v.pipe(v.string(), v.uuid())
const date = v.pipe(v.string(), v.isoDate())
const month = v.pipe(v.string(), v.regex(CALENDAR_MONTH))
/** Blank on the server means "not given"; the domain says null. */
const text = v.pipe(
  v.optional(v.nullable(v.string()), null),
  v.transform((value) => (value === null || value === '' ? null : value)),
)

/** A category this client does not know yet (a clinic's own) is shown as "other", not dropped. */
const categorySchema = v.fallback(v.picklist(EXPENSE_CATEGORIES), 'other')

export const expenseSchema = v.object({
  id,
  clinic_name: v.optional(v.string(), ''),
  spent_on: date,
  category: categorySchema,
  amount: money,
  method: v.picklist(EXPENSE_METHODS),
  payee: text,
  notes: text,
  doctor: v.nullable(id),
  doctor_name: text,
  period: v.optional(v.nullable(month), null),
  recurring: v.optional(v.nullable(id), null),
  created_by_name: text,
  voided_at: v.optional(v.nullable(v.string()), null),
  void_reason: text,
})

export const expensePageSchema = pageSchema(expenseSchema)

const totalsSchema = v.object({
  total: money,
  count: v.pipe(v.number(), v.integer(), v.minValue(0)),
  payroll: money,
  fixed: money,
  variable: money,
})

export const expenseSummarySchema = v.object({
  from: date,
  to: date,
  bucket: v.picklist(['day', 'week', 'month']),
  totals: totalsSchema,
  previous_totals: v.nullable(totalsSchema),
  by_category: v.array(v.object({ category: categorySchema, amount: money })),
  series: v.array(v.object({ start: date, amount: money })),
})

export type ExpenseResponse = v.InferOutput<typeof expenseSchema>
export type ExpensePageResponse = v.InferOutput<typeof expensePageSchema>
export type ExpenseSummaryResponse = v.InferOutput<typeof expenseSummarySchema>

export function toExpense(response: ExpenseResponse): Expense {
  return {
    id: response.id,
    clinicName: response.clinic_name,
    date: response.spent_on,
    category: response.category,
    amount: response.amount,
    method: response.method,
    payee: response.payee,
    note: response.notes,
    doctorId: response.doctor,
    doctorName: response.doctor_name,
    period: response.period,
    isVoid: response.voided_at !== null,
    voidReason: response.void_reason,
    createdBy: response.created_by_name,
    recurringId: response.recurring,
  }
}

export function toExpensePage(response: ExpensePageResponse): ExpensePage {
  return {
    count: response.count,
    hasNext: response.next !== null,
    hasPrevious: response.previous !== null,
    results: response.results.map(toExpense),
  }
}

export function toExpenseSummary(response: ExpenseSummaryResponse): ExpenseSummary {
  return {
    range: { from: response.from, to: response.to, bucket: response.bucket },
    totals: response.totals satisfies ExpenseTotals,
    previousTotals: response.previous_totals,
    byCategory: response.by_category,
    series: response.series,
  }
}

const recurringCategorySchema = v.picklist(RECURRING_CATEGORIES)

export const recurringExpenseSchema = v.object({
  id,
  clinic_name: v.optional(v.string(), ''),
  name: v.string(),
  category: recurringCategorySchema,
  amount: money,
  method: v.picklist(EXPENSE_METHODS),
  payee: text,
  day_of_month: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(28)),
  is_active: v.boolean(),
})

export type RecurringExpenseResponse = v.InferOutput<typeof recurringExpenseSchema>

export function toRecurringExpense(response: RecurringExpenseResponse): RecurringExpense {
  return {
    id: response.id,
    clinicName: response.clinic_name,
    name: response.name,
    category: response.category,
    amount: response.amount,
    method: response.method,
    payee: response.payee,
    dayOfMonth: response.day_of_month,
    isActive: response.is_active,
  }
}

export const dueMonthSchema = v.object({
  month,
  totals: v.object({ expected: money, paid: money, remaining: money }),
  items: v.array(
    v.object({
      recurring: id,
      name: v.string(),
      category: recurringCategorySchema,
      amount: money,
      method: v.picklist(EXPENSE_METHODS),
      payee: text,
      due_date: date,
      status: v.picklist(['due', 'overdue', 'paid', 'skipped']),
      expense: v.nullable(id),
      paid_amount: v.nullable(money),
      paid_on: v.nullable(date),
      skip_reason: text,
    }),
  ),
})

export type DueMonthResponse = v.InferOutput<typeof dueMonthSchema>

export function toDueMonth(response: DueMonthResponse): DueMonth {
  return {
    month: response.month,
    totals: response.totals,
    items: response.items.map((item) => ({
      recurringId: item.recurring,
      name: item.name,
      category: item.category,
      amount: item.amount,
      method: item.method,
      payee: item.payee,
      dueDate: item.due_date,
      status: item.status,
      expenseId: item.expense,
      paidAmount: item.paid_amount,
      paidDate: item.paid_on,
      skipReason: item.skip_reason,
    })),
  }
}

export const compensationSchema = v.object({
  id,
  doctor: id,
  percent: v.pipe(money, v.minValue(0), v.maxValue(100)),
  fixed: money,
  base: v.picklist(COMPENSATION_BASES),
  effective_from: month,
  created_by_name: text,
})

export const compensationPageSchema = pageSchema(compensationSchema)

export type CompensationResponse = v.InferOutput<typeof compensationSchema>

export function toCompensation(response: CompensationResponse): Compensation {
  return {
    id: response.id,
    doctorId: response.doctor,
    percent: response.percent,
    fixed: response.fixed,
    base: response.base,
    effectiveFrom: response.effective_from,
    createdBy: response.created_by_name,
  }
}

const payrollRowSchema = v.object({
  doctor: id,
  doctor_name: v.string(),
  clinic_name: v.optional(v.string(), ''),
  is_active: v.optional(v.boolean(), true),
  compensation: v.nullable(compensationSchema),
  billed: money,
  collected: money,
  base_amount: money,
  accrued: money,
  pending: v.optional(money, 0),
  pending_share: v.optional(money, 0),
  // Signed: negative when a doctor was paid ahead.
  opening: money,
  paid: money,
  balance: money,
})

export const payrollSchema = v.object({
  month,
  rows: v.array(payrollRowSchema),
  totals: v.object({
    accrued: money,
    pending_share: v.optional(money, 0),
    paid: money,
    balance: money,
  }),
})

export type PayrollResponse = v.InferOutput<typeof payrollSchema>

function toPayrollRow(row: v.InferOutput<typeof payrollRowSchema>): PayrollRow {
  return {
    doctorId: row.doctor,
    doctorName: row.doctor_name,
    clinicName: row.clinic_name,
    isActive: row.is_active,
    compensation: row.compensation === null ? null : toCompensation(row.compensation),
    collected: row.collected,
    billed: row.billed,
    baseAmount: row.base_amount,
    accrued: row.accrued,
    pending: row.pending,
    pendingShare: row.pending_share,
    opening: row.opening,
    paid: row.paid,
    balance: row.balance,
  }
}

export function toPayroll(response: PayrollResponse): Payroll {
  return {
    month: response.month,
    totals: {
      accrued: response.totals.accrued,
      pendingShare: response.totals.pending_share,
      paid: response.totals.paid,
      balance: response.totals.balance,
    },
    rows: response.rows.map(toPayrollRow),
  }
}

/** `GET /api/v1/me/earnings/?month`: the signed-in doctor's own month. */
export const earningsSchema = v.object({
  month,
  summary: payrollRowSchema,
  lines: v.array(
    v.object({
      procedure: id,
      performed_at: v.string(),
      patient: id,
      // Null for a patient this doctor may no longer open.
      patient_name: v.nullable(v.string()),
      service_name: v.string(),
      tooth: v.nullable(v.number()),
      total: money,
      paid: money,
      unpaid: money,
      status: v.picklist(EARNINGS_STATUSES),
    }),
  ),
})

export function toEarnings(response: v.InferOutput<typeof earningsSchema>): Earnings {
  return {
    month: response.month,
    summary: toPayrollRow(response.summary),
    lines: response.lines.map((line) => ({
      procedureId: line.procedure,
      performedAt: line.performed_at,
      patientId: line.patient,
      patientName: line.patient_name,
      serviceName: line.service_name,
      tooth: line.tooth,
      total: line.total,
      paid: line.paid,
      unpaid: line.unpaid,
      status: line.status,
    })),
  }
}
