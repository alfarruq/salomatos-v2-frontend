import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { cachePolicy } from '@/shared/config/cache'
import { statsOverviewSchema, toStatsOverview } from '../model/schema'
import type { StatsOverview, StatsRange } from '../model/types'

export const statsKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'stats'] as const,

  overview: (clinicId: string, range: StatsRange) =>
    [...statsKeys.scope(clinicId), 'overview', range] as const,
}

export async function fetchStatsOverview(
  range: StatsRange,
  signal?: AbortSignal,
): Promise<StatsOverview> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  const raw: unknown = await httpClient(
    `v1/reports/statistics/?${params}`,
    signal === undefined ? {} : { signal },
  )
  return toStatsOverview(v.parse(statsOverviewSchema, raw))
}

export const statsQueries = {
  overview: (clinicId: string, range: StatsRange) =>
    queryOptions({
      queryKey: statsKeys.overview(clinicId, range),
      queryFn: ({ signal }) => fetchStatsOverview(range, signal),
      ...cachePolicy.standard,
      // Keeps the current charts on screen while another period loads.
      placeholderData: keepPreviousData,
    }),
}
