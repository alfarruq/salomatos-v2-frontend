import * as v from 'valibot'
import type { Branch } from './types'

/** The national format, matching what `PhoneInput` emits. */
const UZ_PHONE = /^\+998\d{9}$/

/**
 * What a branch is opened or renamed with. Phone and address are optional: the
 * full profile (hours included) is edited under "Clinic" once the branch is chosen.
 */
export const branchFormSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort')),
  phoneNumber: v.pipe(
    v.string(),
    v.check((value) => value === '' || UZ_PHONE.test(value), 'validation.phoneUz'),
  ),
  address: v.pipe(v.string(), v.trim()),
})

export type BranchFormInput = v.InferOutput<typeof branchFormSchema>

export const emptyBranchForm: BranchFormInput = { name: '', phoneNumber: '', address: '' }

export function toBranchForm(branch: Branch): BranchFormInput {
  return { name: branch.name, phoneNumber: branch.phoneNumber, address: branch.address }
}

export function toBranchPayload(input: BranchFormInput): Record<string, string> {
  return { name: input.name, phone_number: input.phoneNumber, address: input.address }
}

const SERVER_FIELD_NAMES: Record<string, keyof BranchFormInput> = {
  name: 'name',
  phone_number: 'phoneNumber',
  address: 'address',
}

/** The inverse, for putting a server error back on the input that caused it (§10). */
export function branchFormFieldOf(serverField: string): keyof BranchFormInput | 'root' {
  return SERVER_FIELD_NAMES[serverField] ?? 'root'
}
