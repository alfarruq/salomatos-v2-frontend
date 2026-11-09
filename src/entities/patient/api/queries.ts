import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import type { Page } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import {
  type MedicalHistory,
  medicalHistorySchema,
  toMedicalHistory,
} from '../model/medicalHistory'
import { patientPageSchema, patientSchema, toPatient } from '../model/schema'
import type { Patient, PatientFilters, PatientId } from '../model/types'

/**
 * §6.2: the tenant scope is inside every key. The server picks the branch from
 * the `X-Clinic-Id` header; the key is what stops the cache serving one
 * branch's patients to another after a switch.
 */
export const patientKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'patients'] as const,

  list: (clinicId: string, filters: PatientFilters) =>
    [...patientKeys.scope(clinicId), 'list', filters] as const,

  detail: (clinicId: string, patientId: PatientId) =>
    [...patientKeys.scope(clinicId), 'detail', patientId] as const,

  medicalHistory: (clinicId: string, patientId: PatientId) =>
    [...patientKeys.detail(clinicId, patientId), 'medical-history'] as const,
}

/** Non-PHI filters only. The search text never goes here (§3). */
function toQueryString(filters: PatientFilters): string {
  const params = new URLSearchParams()
  if (filters.doctorId !== null) params.set('primary_doctor', filters.doctorId)
  if (filters.archived) params.set('archived', 'true')
  if (filters.page > 1) params.set('page', String(filters.page))
  const query = params.toString()
  return query === '' ? '' : `?${query}`
}

/** The backend refuses a search shorter than this; below it the plain list is shown. */
export const MIN_SEARCH_LENGTH = 2

export async function fetchPatients(
  filters: PatientFilters,
  signal?: AbortSignal,
): Promise<Page<Patient>> {
  const search = filters.search.trim()
  const init = signal === undefined ? {} : { signal }

  const raw =
    search.length >= MIN_SEARCH_LENGTH
      ? await httpClient<unknown>(
          `v1/patients/search/${filters.page > 1 ? `?page=${filters.page}` : ''}`,
          {
            ...init,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: search, include_archived: filters.archived }),
          },
        )
      : await httpClient<unknown>(`v1/patients/${toQueryString(filters)}`, init)

  const page = v.parse(patientPageSchema, raw)
  return { ...page, results: page.results.map(toPatient) }
}

export async function fetchPatient(patientId: PatientId, signal?: AbortSignal): Promise<Patient> {
  const raw = await httpClient<unknown>(
    `v1/patients/${patientId}/`,
    signal === undefined ? {} : { signal },
  )
  return toPatient(v.parse(patientSchema, raw))
}

export async function fetchMedicalHistory(
  patientId: PatientId,
  signal?: AbortSignal,
): Promise<MedicalHistory> {
  const raw = await httpClient<unknown>(
    `v1/patients/${patientId}/medical-history/`,
    signal === undefined ? {} : { signal },
  )
  return toMedicalHistory(v.parse(medicalHistorySchema, raw))
}

export const patientQueries = {
  list: (clinicId: string, filters: PatientFilters) =>
    queryOptions({
      queryKey: patientKeys.list(clinicId, filters),
      queryFn: ({ signal }) => fetchPatients(filters, signal),
      ...cachePolicy.standard,
      // Keeps the previous page on screen while the next loads, so typing does not blank the table.
      placeholderData: keepPreviousData,
    }),

  detail: (clinicId: string, patientId: PatientId) =>
    queryOptions({
      queryKey: patientKeys.detail(clinicId, patientId),
      queryFn: ({ signal }) => fetchPatient(patientId, signal),
      ...cachePolicy.standard,
    }),
  medicalHistory: (clinicId: string, patientId: PatientId) =>
    queryOptions({
      queryKey: patientKeys.medicalHistory(clinicId, patientId),
      queryFn: ({ signal }) => fetchMedicalHistory(patientId, signal),
      ...cachePolicy.standard,
    }),
}
