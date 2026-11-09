import { queryOptions } from '@tanstack/react-query'
import { httpClient } from '@/shared/api/httpClient'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import { administratorSchema, toAdministrator } from '../model/schema'
import type { Administrator } from '../model/types'

/**
 * §6.2 — `clinicId` is inside every key. Not sent to the server, which
 * resolves the tenant from `request.user`; it keeps one account's staff list
 * from being served to another out of memory.
 */
export const administratorKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'administrators'] as const,
  list: (clinicId: string) => [...administratorKeys.scope(clinicId), 'list'] as const,
  inactive: (clinicId: string) => [...administratorKeys.scope(clinicId), 'inactive'] as const,
}

/** Active admins by default; deactivated ones are listed apart so they can be brought back. */
export async function fetchAdministrators(
  signal?: AbortSignal,
  isActive = true,
): Promise<Administrator[]> {
  const init = signal === undefined ? {} : { signal }
  const rows = await fetchAllPages(
    `v1/staff/?role=admin&is_active=${isActive}&page_size=100`,
    administratorSchema,
    (path) => httpClient<unknown>(path, init),
  )
  return rows.map(toAdministrator)
}

export const administratorQueries = {
  list: (clinicId: string) =>
    queryOptions({
      queryKey: administratorKeys.list(clinicId),
      queryFn: ({ signal }) => fetchAdministrators(signal),
      // Staff, filed with doctors under §6.3.
      ...cachePolicy.standard,
    }),

  inactive: (clinicId: string) =>
    queryOptions({
      queryKey: administratorKeys.inactive(clinicId),
      queryFn: ({ signal }) => fetchAdministrators(signal, false),
      ...cachePolicy.standard,
    }),
}
