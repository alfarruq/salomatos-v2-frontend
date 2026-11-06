import { queryOptions } from '@tanstack/react-query'
import { httpClient } from '@/shared/api/httpClient'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import { doctorTypeSchema, toDoctorType } from '../model/schema'
import type { DoctorType } from '../model/types'

/** §6.2 — `clinicId` is inside every key, without exception. */
export const doctorTypeKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'doctor-types'] as const,
  list: (clinicId: string) => [...doctorTypeKeys.scope(clinicId), 'list'] as const,
}

export async function fetchDoctorTypes(signal?: AbortSignal): Promise<DoctorType[]> {
  const init = signal === undefined ? {} : { signal }
  const rows = await fetchAllPages('v1/specialties/?page_size=100', doctorTypeSchema, (path) =>
    httpClient<unknown>(path, init),
  )
  return rows.map(toDoctorType)
}

export const doctorTypeQueries = {
  list: (clinicId: string) =>
    queryOptions({
      queryKey: doctorTypeKeys.list(clinicId),
      queryFn: ({ signal }) => fetchDoctorTypes(signal),
      // `static` (§6.3) — a clinic's list of doctor categories changes about
      // as often as its price list, and any doctor form will read it.
      ...cachePolicy.static,
    }),
}
