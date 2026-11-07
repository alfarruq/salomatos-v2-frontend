import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import type { ReportRange } from '@/shared/lib/report'
import {
  compensationSchema,
  dueMonthSchema,
  expensePageSchema,
  expenseSummarySchema,
  payrollSchema,
  recurringExpenseSchema,
  toCompensation,
  toDueMonth,
  toExpensePage,
  toExpenseSummary,
  toPayroll,
  toRecurringExpense,
} from '../model/schema'
import type {
  CalendarMonth,
  Compensation,
  DueMonth,
  ExpenseFilters,
  ExpensePage,
  ExpenseSummary,
  Payroll,
  RecurringExpense,
} from '../model/types'

/** §6.2 — the tenant scope is inside every key, without exception. */
export const expenseKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'expenses'] as const,

  list: (clinicId: string, filters: ExpenseFilters) =>
    [...expenseKeys.scope(clinicId), 'list', filters] as const,

  summary: (clinicId: string, range: ReportRange) =>
    [...expenseKeys.scope(clinicId), 'summary', range] as const,

  // Under the same scope on purpose: paying a bill adds an expense, so one
  // invalidation refreshes the journal, the summary and the month together.
  recurring: (clinicId: string) => [...expenseKeys.scope(clinicId), 'recurring'] as const,

  due: (clinicId: string, month: CalendarMonth) =>
    [...expenseKeys.scope(clinicId), 'due', month] as const,

  // Payroll reads the doctor_share expenses, so it lives under the same scope.
  payroll: (clinicId: string, month: CalendarMonth) =>
    [...expenseKeys.scope(clinicId), 'payroll', month] as const,

  compensation: (clinicId: string, doctorId: string) =>
    [...expenseKeys.scope(clinicId), 'compensation', doctorId] as const,
}

function withSignal(signal: AbortSignal | undefined) {
  return signal === undefined ? {} : { signal }
}

export async function fetchExpenses(
  filters: ExpenseFilters,
  signal?: AbortSignal,
): Promise<ExpensePage> {
  const params = new URLSearchParams({
    spent_from: filters.from,
    spent_to: filters.to,
    page: String(filters.page),
  })
  if (filters.category !== null) params.set('category', filters.category)
  const raw: unknown = await httpClient(`v1/expenses/?${params}`, withSignal(signal))
  return toExpensePage(v.parse(expensePageSchema, raw))
}

export async function fetchExpenseSummary(
  range: ReportRange,
  signal?: AbortSignal,
): Promise<ExpenseSummary> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  const raw: unknown = await httpClient(`v1/expenses/summary/?${params}`, withSignal(signal))
  return toExpenseSummary(v.parse(expenseSummarySchema, raw))
}

export async function fetchRecurringExpenses(signal?: AbortSignal): Promise<RecurringExpense[]> {
  const rows = await fetchAllPages(
    'v1/recurring-expenses/?page_size=100',
    recurringExpenseSchema,
    (path) => httpClient<unknown>(path, withSignal(signal)),
  )
  return rows.map(toRecurringExpense)
}

export async function fetchDueMonth(month: CalendarMonth, signal?: AbortSignal): Promise<DueMonth> {
  const raw: unknown = await httpClient(
    `v1/recurring-expenses/due/?month=${month}`,
    withSignal(signal),
  )
  return toDueMonth(v.parse(dueMonthSchema, raw))
}

export async function fetchPayroll(month: CalendarMonth, signal?: AbortSignal): Promise<Payroll> {
  const raw: unknown = await httpClient(`v1/payroll/?month=${month}`, withSignal(signal))
  return toPayroll(v.parse(payrollSchema, raw))
}

/** Newest first, as the server orders it. */
export async function fetchCompensationHistory(
  doctorId: string,
  signal?: AbortSignal,
): Promise<Compensation[]> {
  const rows = await fetchAllPages(
    `v1/compensations/?doctor=${doctorId}&page_size=100`,
    compensationSchema,
    (path) => httpClient<unknown>(path, withSignal(signal)),
  )
  return rows.map(toCompensation)
}

export const expenseQueries = {
  list: (clinicId: string, filters: ExpenseFilters) =>
    queryOptions({
      queryKey: expenseKeys.list(clinicId, filters),
      queryFn: ({ signal }) => fetchExpenses(filters, signal),
      // Money: always refetched (§6.3), never optimistic.
      ...cachePolicy.financial,
      // Keeps the current page on screen while the next one loads.
      placeholderData: keepPreviousData,
    }),

  summary: (clinicId: string, range: ReportRange) =>
    queryOptions({
      queryKey: expenseKeys.summary(clinicId, range),
      queryFn: ({ signal }) => fetchExpenseSummary(range, signal),
      ...cachePolicy.financial,
      placeholderData: keepPreviousData,
    }),

  recurring: (clinicId: string) =>
    queryOptions({
      queryKey: expenseKeys.recurring(clinicId),
      queryFn: ({ signal }) => fetchRecurringExpenses(signal),
      ...cachePolicy.financial,
    }),

  due: (clinicId: string, month: CalendarMonth) =>
    queryOptions({
      queryKey: expenseKeys.due(clinicId, month),
      queryFn: ({ signal }) => fetchDueMonth(month, signal),
      ...cachePolicy.financial,
      placeholderData: keepPreviousData,
    }),

  payroll: (clinicId: string, month: CalendarMonth) =>
    queryOptions({
      queryKey: expenseKeys.payroll(clinicId, month),
      queryFn: ({ signal }) => fetchPayroll(month, signal),
      ...cachePolicy.financial,
      placeholderData: keepPreviousData,
    }),

  compensation: (clinicId: string, doctorId: string) =>
    queryOptions({
      queryKey: expenseKeys.compensation(clinicId, doctorId),
      queryFn: ({ signal }) => fetchCompensationHistory(doctorId, signal),
      ...cachePolicy.financial,
    }),
}
