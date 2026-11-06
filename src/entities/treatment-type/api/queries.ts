import { queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { pathFromNext } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import {
  type TreatmentTypeResponse,
  toTreatmentType,
  treatmentTypePageSchema,
} from '../model/schema'
import type { TreatmentType } from '../model/types'

/** §6.2 — `clinicId` is inside every key, without exception. */
export const treatmentTypeKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'treatment-types'] as const,
  list: (clinicId: string) => [...treatmentTypeKeys.scope(clinicId), 'list'] as const,
}

/**
 * Follows every page rather than exposing pagination to the caller — see the
 * schema module for why this is paginated at all. A clinic's price list is a
 * few dozen rows at most (§1), not the thousand-patient case pagination
 * exists for, so the admin screen wants the whole thing on one request rather
 * than page-number controls nobody asked for on a settings screen.
 */
export async function fetchTreatmentTypes(signal?: AbortSignal): Promise<TreatmentType[]> {
  const responses: TreatmentTypeResponse[] = []
  let path: string | null = 'v1/services/?page_size=100'

  while (path !== null) {
    const raw: unknown = await httpClient(path, signal === undefined ? {} : { signal })
    const page: v.InferOutput<typeof treatmentTypePageSchema> = v.parse(
      treatmentTypePageSchema,
      raw,
    )
    responses.push(...page.results)
    path = page.next === null ? null : pathFromNext(page.next)
  }

  return responses.map(toTreatmentType)
}

export const treatmentTypeQueries = {
  list: (clinicId: string) =>
    queryOptions({
      queryKey: treatmentTypeKeys.list(clinicId),
      queryFn: ({ signal }) => fetchTreatmentTypes(signal),
      /*
       * `static` — §6.3 names exactly this: services and reference data. A
       * price list changes a few times a year, and every treatment form and
       * appointment screen will read it. Refetching that every five minutes
       * across a thousand clinics is the load problem §6.3 exists to prevent.
       */
      ...cachePolicy.static,
    }),
}
