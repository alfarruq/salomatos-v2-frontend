import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { cachePolicy } from '@/shared/config/cache'
import { statsOverviewSchema, toStatsOverview } from '../model/schema'
import type { StatsOverview, StatsRange } from '../model/types'

export const statsKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'stats'] as const,

  overview: (clinicId: string, range: StatsRange, doctorId: string | null) =>
    [...statsKeys.scope(clinicId), 'overview', range, { doctorId }] as const,
}

/**
 * `doctorId` narrows the figures to one doctor; only an owner's is honoured. A
 * doctor always gets their own figures, whatever is sent, so the filter cannot
 * widen what they see.
 */
export async function fetchStatsOverview(
  range: StatsRange,
  doctorId: string | null,
  signal?: AbortSignal,
): Promise<StatsOverview> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  if (doctorId !== null) params.set('doctor', doctorId)
  const raw: unknown = await httpClient(
    `v1/reports/statistics/?${params}`,
    signal === undefined ? {} : { signal },
  )
  return toStatsOverview(v.parse(statsOverviewSchema, raw))
}

export const statsQueries = {
  overview: (clinicId: string, range: StatsRange, doctorId: string | null = null) =>
    queryOptions({
      queryKey: statsKeys.overview(clinicId, range, doctorId),
      queryFn: ({ signal }) => fetchStatsOverview(range, doctorId, signal),
      ...cachePolicy.standard,
      // Keeps the current charts on screen while another period loads.
      placeholderData: keepPreviousData,
    }),
}
