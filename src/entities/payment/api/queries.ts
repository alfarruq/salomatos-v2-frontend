import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { fetchAllPages, type Page } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import {
  balancePageSchema,
  balanceSchema,
  paymentSchema,
  toBalance,
  toPayment,
} from '../model/schema'
import type { DebtorFilters, PatientBalance, Payment } from '../model/types'

/** §6.2 — the tenant scope is inside every key, without exception. */
export const paymentKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'payments'] as const,
  list: (clinicId: string, patientId: string) =>
    [...paymentKeys.scope(clinicId), 'list', patientId] as const,
}

/** Procedure and payment writes both move these, so they share one prefix to invalidate. */
export const balanceKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'balances'] as const,
  detail: (clinicId: string, patientId: string) =>
    [...balanceKeys.scope(clinicId), 'detail', patientId] as const,
  debtors: (clinicId: string, filters: DebtorFilters) =>
    [...balanceKeys.scope(clinicId), 'debtors', filters] as const,
}

function withSignal(signal: AbortSignal | undefined) {
  return signal === undefined ? {} : { signal }
}

/** Voided payments included: the card shows the ledger as it happened. */
export async function fetchPayments(patientId: string, signal?: AbortSignal): Promise<Payment[]> {
  const rows = await fetchAllPages(
    `v1/payments/?patient=${patientId}&page_size=100`,
    paymentSchema,
    (path) => httpClient<unknown>(path, withSignal(signal)),
  )
  return rows.map(toPayment)
}

export async function fetchBalance(
  patientId: string,
  signal?: AbortSignal,
): Promise<PatientBalance> {
  const raw: unknown = await httpClient(`v1/balances/${patientId}/`, withSignal(signal))
  return toBalance(v.parse(balanceSchema, raw))
}

export async function fetchDebtors(
  filters: DebtorFilters,
  signal?: AbortSignal,
): Promise<Page<PatientBalance>> {
  const raw: unknown = await httpClient(
    `v1/balances/?has_debt=true&page=${filters.page}`,
    withSignal(signal),
  )
  const page = v.parse(balancePageSchema, raw)
  return { ...page, results: page.results.map(toBalance) }
}

export const paymentQueries = {
  list: (clinicId: string, patientId: string) =>
    queryOptions({
      queryKey: paymentKeys.list(clinicId, patientId),
      queryFn: ({ signal }) => fetchPayments(patientId, signal),
      ...cachePolicy.financial,
    }),

  balance: (clinicId: string, patientId: string) =>
    queryOptions({
      queryKey: balanceKeys.detail(clinicId, patientId),
      queryFn: ({ signal }) => fetchBalance(patientId, signal),
      ...cachePolicy.financial,
    }),

  debtors: (clinicId: string, filters: DebtorFilters) =>
    queryOptions({
      queryKey: balanceKeys.debtors(clinicId, filters),
      queryFn: ({ signal }) => fetchDebtors(filters, signal),
      ...cachePolicy.financial,
      placeholderData: keepPreviousData,
    }),
}
