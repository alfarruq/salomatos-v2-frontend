import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import { parseCalendarDate } from '@/shared/lib/calendarDate'
import type { Patient } from './types'

/** Absent, null and "" all mean "nothing here": DRF sends blank CharFields as "". */
const optionalText = v.pipe(
  v.optional(v.nullable(v.string()), null),
  v.transform((value) => (value === null || value.trim() === '' ? null : value)),
)

/** DRF sends `DecimalField` as a string; null when the caller may not see money. */
const debt = v.pipe(
  v.optional(v.nullable(v.union([v.string(), v.number()])), null),
  v.transform((value) => (value === null ? null : Number(value))),
  v.check((value) => value === null || Number.isFinite(value)),
)

/** The wire contract for `PatientSerializer`, validated at runtime (ADR-006). */
export const patientSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  full_name: v.string(),
  clinic: v.optional(v.string(), ''),
  clinic_name: v.optional(v.string(), ''),
  phone_number: optionalText,
  birth_date: optionalText,
  workplace: optionalText,
  address: optionalText,
  notes: optionalText,
  primary_doctor: v.optional(v.nullable(v.string()), null),
  primary_doctor_name: optionalText,
  archived_at: v.optional(v.nullable(v.string()), null),
  created_at: v.optional(v.nullable(v.string()), null),
  is_lead: v.optional(v.boolean(), false),
  debt,
})

export const patientPageSchema = pageSchema(patientSchema)

export type PatientResponse = v.InferOutput<typeof patientSchema>

/** `null` for anything the backend sent that is not a real calendar date. */
function toCalendarDateOrNull(value: string | null): string | null {
  if (value === null) return null
  return parseCalendarDate(value) === null ? null : value
}

export function toPatient(response: PatientResponse): Patient {
  return {
    id: response.id,
    clinicId: response.clinic,
    clinicName: response.clinic_name,
    fullName: response.full_name,
    phoneNumber: response.phone_number,
    birthDate: toCalendarDateOrNull(response.birth_date),
    workplace: response.workplace,
    address: response.address,
    notes: response.notes,
    primaryDoctorId: response.primary_doctor,
    primaryDoctorName: response.primary_doctor_name,
    status: response.archived_at === null ? 'active' : 'archived',
    createdAt: response.created_at,
    isLead: response.is_lead,
    debt: response.debt,
  }
}

/** Same mapper; the list and detail serializers are one serializer now. */
export const toPatientListItem = toPatient
