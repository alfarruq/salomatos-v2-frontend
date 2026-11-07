import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { cachePolicy } from '@/shared/config/cache'
import type { ReportRange } from '@/shared/lib/report'
import { financeOverviewSchema, toFinanceOverview } from '../model/schema'
import type { FinanceOverview } from '../model/types'

export const financeKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'finance'] as const,

  overview: (clinicId: string, range: ReportRange) =>
    [...financeKeys.scope(clinicId), 'overview', range] as const,
}

export async function fetchFinanceOverview(
  range: ReportRange,
  signal?: AbortSignal,
): Promise<FinanceOverview> {
  const params = new URLSearchParams({ from: range.from, to: range.to })
  const raw: unknown = await httpClient(
    `v1/reports/finance/?${params}`,
    signal === undefined ? {} : { signal },
  )
  return toFinanceOverview(v.parse(financeOverviewSchema, raw))
}

export const financeQueries = {
  overview: (clinicId: string, range: ReportRange) =>
    queryOptions({
      queryKey: financeKeys.overview(clinicId, range),
      queryFn: ({ signal }) => fetchFinanceOverview(range, signal),
      // Money: always refetched (§6.3), never optimistic.
      ...cachePolicy.financial,
      // Keeps the current figures on screen while another period loads.
      placeholderData: keepPreviousData,
    }),
}
