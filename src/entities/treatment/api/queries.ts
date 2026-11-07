import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { fetchAllPages, type Page } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import { toTreatment, treatmentPageSchema, treatmentSchema } from '../model/schema'
import type { Treatment, TreatmentListFilters } from '../model/types'

/** §6.2 — the tenant scope is inside every key, without exception. */
export const treatmentKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'treatments'] as const,

  list: (clinicId: string, patientId: string) =>
    [...treatmentKeys.scope(clinicId), 'list', patientId] as const,

  page: (clinicId: string, filters: TreatmentListFilters) =>
    [...treatmentKeys.scope(clinicId), 'page', filters] as const,
}

/** Every procedure of one patient, voided ones included: the card shows the history as it happened. */
export async function fetchTreatments(
  patientId: string,
  signal?: AbortSignal,
): Promise<Treatment[]> {
  const init = signal === undefined ? {} : { signal }
  const rows = await fetchAllPages(
    `v1/procedures/?patient=${patientId}&page_size=100`,
    treatmentSchema,
    (path) => httpClient<unknown>(path, init),
  )
  return rows.map(toTreatment)
}

function toPageQuery(filters: TreatmentListFilters): string {
  const params = new URLSearchParams({ page: String(filters.page) })
  if (filters.patientId !== null) params.set('patient', filters.patientId)
  if (filters.doctorId !== null) params.set('doctor', filters.doctorId)
  if (filters.treatmentTypeId !== null) params.set('service', filters.treatmentTypeId)
  if (filters.status !== null) {
    params.set('voided', filters.status === 'voided' ? 'true' : 'false')
    if (filters.status !== 'voided') {
      params.set('status', filters.status === 'inProgress' ? 'in_progress' : 'completed')
    }
  }
  return params.toString()
}

export async function fetchTreatmentPage(
  filters: TreatmentListFilters,
  signal?: AbortSignal,
): Promise<Page<Treatment>> {
  const raw: unknown = await httpClient(
    `v1/procedures/?${toPageQuery(filters)}`,
    signal === undefined ? {} : { signal },
  )
  const page = v.parse(treatmentPageSchema, raw)
  return { ...page, results: page.results.map(toTreatment) }
}

export const treatmentQueries = {
  list: (clinicId: string, patientId: string) =>
    queryOptions({
      queryKey: treatmentKeys.list(clinicId, patientId),
      queryFn: ({ signal }) => fetchTreatments(patientId, signal),
      // `financial` (§6.3): these rows are the patient's bill.
      ...cachePolicy.financial,
    }),

  page: (clinicId: string, filters: TreatmentListFilters) =>
    queryOptions({
      queryKey: treatmentKeys.page(clinicId, filters),
      queryFn: ({ signal }) => fetchTreatmentPage(filters, signal),
      ...cachePolicy.financial,
      // Keeps the current rows on screen while the next page loads.
      placeholderData: keepPreviousData,
    }),
}
