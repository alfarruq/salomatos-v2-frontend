import { queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { cachePolicy } from '@/shared/config/cache'
import { branchSchema, toBranch } from '../model/schema'
import type { Branch } from '../model/types'

/** §6.2 — `clinicId` is inside every key, without exception. */
export const branchKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'branches'] as const,
  list: (clinicId: string) => [...branchKeys.scope(clinicId), 'list'] as const,
  doctors: (clinicId: string, branchId: string) =>
    [...branchKeys.scope(clinicId), 'doctors', branchId] as const,
}

const branchDoctorSchema = v.object({ id: v.pipe(v.string(), v.uuid()), full_name: v.string() })

export interface BranchDoctor {
  id: string
  fullName: string
}

/** Active doctors of another branch, for handing moved patients over. Owner only. */
export async function fetchBranchDoctors(
  branchId: string,
  signal?: AbortSignal,
): Promise<BranchDoctor[]> {
  const raw = await httpClient<unknown>(
    `v1/branches/${branchId}/doctors/`,
    signal === undefined ? {} : { signal },
  )
  return v
    .parse(v.array(branchDoctorSchema), raw)
    .map((row) => ({ id: row.id, fullName: row.full_name }))
}

/** Every branch of the organization, closed ones included, oldest first. A plain array. */
export async function fetchBranches(signal?: AbortSignal): Promise<Branch[]> {
  const raw = await httpClient<unknown>('v1/branches/', signal === undefined ? {} : { signal })
  return v.parse(v.array(branchSchema), raw).map(toBranch)
}

export const branchQueries = {
  list: (clinicId: string) =>
    queryOptions({
      queryKey: branchKeys.list(clinicId),
      queryFn: ({ signal }) => fetchBranches(signal),
      // `standard`, not `static`: the staff and patient counts move every day.
      ...cachePolicy.standard,
    }),
  doctors: (clinicId: string, branchId: string) =>
    queryOptions({
      queryKey: branchKeys.doctors(clinicId, branchId),
      queryFn: ({ signal }) => fetchBranchDoctors(branchId, signal),
      ...cachePolicy.standard,
    }),
}
