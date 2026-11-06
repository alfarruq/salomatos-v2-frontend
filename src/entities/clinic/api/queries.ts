import { queryOptions } from '@tanstack/react-query'
import * as v from 'valibot'
import { httpClient } from '@/shared/api/httpClient'
import { cachePolicy } from '@/shared/config/cache'
import { clinicSchema, toClinic } from '../model/schema'
import type { Clinic } from '../model/types'

/** §6.2 — `clinicId` is inside every key, without exception. */
export const clinicKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'profile'] as const,
  mine: (clinicId: string) => [...clinicKeys.scope(clinicId), 'mine'] as const,
}

/**
 * The account's own `Clinic` row, or null when none has been created yet.
 *
 * `GET /clinic/` returns a plain array filtered to `admin=request.user`
 * (`get_clinics`), so in practice it holds at most one — nothing prevents a
 * second `POST` from creating another, but the admin panel only ever shows
 * the first and never offers a second create once one exists.
 *
 * ⚠️ Whichever row comes back, it has no `id` (see `model/schema.ts`), so
 * there is no way to `PATCH` or `DELETE` it. Once created, a clinic's profile
 * can only be created — not edited — until the server adds one.
 */
/** The branch picked by `X-Clinic-Id`. Every branch has a profile, so this is never empty. */
export async function fetchClinic(signal?: AbortSignal): Promise<Clinic> {
  const raw = await httpClient<unknown>('v1/clinic/', signal === undefined ? {} : { signal })
  return toClinic(v.parse(clinicSchema, raw))
}

export const clinicQueries = {
  mine: (clinicId: string) =>
    queryOptions({
      queryKey: clinicKeys.mine(clinicId),
      queryFn: ({ signal }) => fetchClinic(signal),
      // `static` (§6.3) — a clinic's own address and hours change rarely.
      ...cachePolicy.static,
    }),
}
