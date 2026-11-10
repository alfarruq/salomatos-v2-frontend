import * as v from 'valibot'
import type { Branch } from './types'

/** The wire contract for `/branches/` (`apps/tenancy/branches.py`), validated at runtime (ADR-006). */
export const branchSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  name: v.pipe(v.string(), v.minLength(1)),
  phone_number: v.optional(v.string(), ''),
  address: v.optional(v.string(), ''),
  is_active: v.boolean(),
  staff_count: v.optional(v.number(), 0),
  patient_count: v.optional(v.number(), 0),
})

export type BranchResponse = v.InferOutput<typeof branchSchema>

export function toBranch(response: BranchResponse): Branch {
  return {
    id: response.id,
    name: response.name,
    phoneNumber: response.phone_number,
    address: response.address,
    isActive: response.is_active,
    staffCount: response.staff_count,
    patientCount: response.patient_count,
  }
}
