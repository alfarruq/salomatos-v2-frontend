import { queryOptions } from '@tanstack/react-query'
import { httpClient } from '@/shared/api/httpClient'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import { staffSchema, toDoctor } from '../model/schema'
import type { Doctor } from '../model/types'

/** §6.2 — the tenant scope is inside every key, without exception. */
export const doctorKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'doctors'] as const,
  list: (clinicId: string) => [...doctorKeys.scope(clinicId), 'list'] as const,
  inactive: (clinicId: string) => [...doctorKeys.scope(clinicId), 'inactive'] as const,
}

/**
 * Active doctors of the branch. `staff/` is paginated; a clinic has a handful of
 * doctors, so every page is read and the pickers get the whole list.
 */
export async function fetchDoctors(signal?: AbortSignal, isActive = true): Promise<Doctor[]> {
  const init = signal === undefined ? {} : { signal }
  const rows = await fetchAllPages(
    `v1/staff/?role=doctor&is_active=${isActive}&page_size=100`,
    staffSchema,
    (path) => httpClient<unknown>(path, init),
  )
  return rows.map(toDoctor)
}

export const doctorQueries = {
  list: (clinicId: string) =>
    queryOptions({
      queryKey: doctorKeys.list(clinicId),
      queryFn: ({ signal }) => fetchDoctors(signal),
      // A new doctor has to appear in the appointment form the same day.
      ...cachePolicy.standard,
    }),

  /** Deactivated doctors, for Boshqaruv only; pickers never offer them. */
  inactive: (clinicId: string) =>
    queryOptions({
      queryKey: doctorKeys.inactive(clinicId),
      queryFn: ({ signal }) => fetchDoctors(signal, false),
      ...cachePolicy.standard,
    }),
}
