import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import type { Administrator } from './types'

/**
 * The wire contract for `staff/?role=admin` (`StaffSerializer`), validated
 * at runtime (ADR-006). A plain array, like `/clinic/doctors/`.
 */

/** Absent or null both mean "nothing here" — see `sessionSchema` for why. */
const optionalString = v.pipe(
  v.optional(v.nullable(v.string()), null),
  v.transform((value) => (value === null || value === '' ? null : value)),
)

export const administratorSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  full_name: v.string(),
  username: optionalString,
  phone_number: optionalString,
  email: optionalString,
  is_active: v.optional(v.boolean(), true),
})

export const administratorPageSchema = pageSchema(administratorSchema)

export type AdministratorResponse = v.InferOutput<typeof administratorSchema>

export function toAdministrator(response: AdministratorResponse): Administrator {
  return {
    id: response.id,
    fullName: response.full_name,
    username: response.username,
    phoneNumber: response.phone_number,
    email: response.email,
    isActive: response.is_active,
  }
}
