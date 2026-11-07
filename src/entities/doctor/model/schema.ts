import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import type { Doctor } from './types'

/** Absent, null and "" all mean "nothing here": DRF sends blank CharFields as "". */
const optionalText = v.pipe(
  v.optional(v.nullable(v.string()), null),
  v.transform((value) => (value === null || value === '' ? null : value)),
)

/** DRF sends `DecimalField` as a string; so'm fit a double exactly. */
const money = v.pipe(
  v.union([v.string(), v.number()]),
  v.transform((value) => Number(value)),
  v.check((value: number) => Number.isFinite(value)),
)

/** `PayTermsSerializer`: only sent to someone who may see pay, and only for doctors. */
const payTermsSchema = v.object({
  percent: money,
  fixed: money,
  base: v.picklist(['collected', 'billed']),
  effective_from: v.string(),
})

/** `StaffSerializer`, validated at runtime (ADR-006). */
export const staffSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  full_name: v.string(),
  username: optionalText,
  phone_number: optionalText,
  email: optionalText,
  role: v.string(),
  is_active: v.optional(v.boolean(), true),
  specialty: v.optional(v.nullable(v.string()), null),
  specialty_name: optionalText,
  experience_years: v.optional(v.nullable(v.number()), null),
  current_compensation: v.optional(v.nullable(payTermsSchema), null),
})

export const staffPageSchema = pageSchema(staffSchema)

/** Kept under the old names: a doctor row is a staff row. */
export const doctorSchema = staffSchema
export const doctorPageSchema = staffPageSchema

export type DoctorResponse = v.InferOutput<typeof staffSchema>

export function toDoctor(response: DoctorResponse): Doctor {
  return {
    id: response.id,
    fullName: response.full_name,
    username: response.username,
    phoneNumber: response.phone_number,
    email: response.email,
    doctorTypeId: response.specialty,
    doctorTypeName: response.specialty_name,
    experienceYears: response.experience_years,
    isActive: response.is_active,
    currentPay:
      response.current_compensation === null
        ? null
        : {
            percent: response.current_compensation.percent,
            fixed: response.current_compensation.fixed,
            base: response.current_compensation.base,
            effectiveFrom: response.current_compensation.effective_from,
          },
  }
}
