import * as v from 'valibot'
import { parseTypedDate, toTypedDate } from '@/shared/lib/calendarDate'
import { clinicNow } from '@/shared/lib/datetime'
import type { Patient } from './types'

/**
 * The writable shape of a patient — what `PatientSerializer`
 * accepts.
 *
 * **Why this lives in the entity rather than in a feature.** `patient-create`
 * and `patient-edit` are two slices in the same layer, and §4 forbids one from
 * importing the other; they compose only at the widget level. Both send the
 * same fields to the same serializer, so the choice is between duplicating the
 * schema and the field markup in two places, or keeping the *definition of
 * what a patient is* with the entity and letting each feature own only its
 * mutation. The second keeps one source of truth for the contract.
 */

/**
 * The national format, matching what `PhoneInput` emits.
 *
 * Deliberately stricter than the server's `^\+?[1-9]\d{6,14}$`, which would
 * accept a seven-digit number from anywhere. Every patient of a Tashkent
 * dental clinic has an Uzbek number, and catching a typo here is better than a
 * 400 later.
 */
const UZ_PHONE = /^\+998\d{9}$/

/**
 * Form values are all strings — that is what inputs hold, and an empty string
 * is what an untouched optional field looks like. The mapping to the wire's
 * nulls happens in `toPatientPayload`, at the boundary, once.
 */
export const patientFormSchema = v.object({
  fullName: v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort')),
  phoneNumber: v.pipe(v.string(), v.regex(UZ_PHONE, 'validation.phoneUz')),
  /** A staff id, or '' for "no primary doctor yet" — the serializer accepts null. */
  doctorId: v.string(),
  gender: v.picklist(['', 'male', 'female']),
  /**
   * Held as typed, `dd/mm/yyyy`, and converted to the wire's `yyyy-MM-dd` in
   * `toPatientPayload`. Optional, but not a licence to send nonsense:
   * `parseTypedDate` rejects 31/02/2026, which JavaScript would otherwise turn
   * into 3 March.
   */
  birthDate: v.pipe(
    v.string(),
    v.check((value) => value === '' || parseTypedDate(value) !== null, 'validation.invalid'),
    // The clinic's day (§14), the same one the form defaults to; the browser's
    // own day can lag behind it and would refuse a baby born this morning.
    v.check((value) => {
      const date = parseTypedDate(value)
      return date === null || date <= clinicNow().date
    }, 'validation.futureDate'),
  ),
  address: v.string(),
  notes: v.string(),
})

export type PatientFormInput = v.InferOutput<typeof patientFormSchema>

export const emptyPatientForm: PatientFormInput = {
  fullName: '',
  phoneNumber: '',
  doctorId: '',
  gender: '',
  birthDate: '',
  address: '',
  notes: '',
}

/** Fills the form from an existing patient, for editing. */
export function toPatientForm(
  patient: Pick<
    Patient,
    'fullName' | 'phoneNumber' | 'birthDate' | 'address' | 'notes' | 'gender' | 'primaryDoctorId'
  >,
): PatientFormInput {
  return {
    fullName: patient.fullName,
    phoneNumber: patient.phoneNumber ?? '',
    doctorId: patient.primaryDoctorId ?? '',
    gender: patient.gender ?? '',
    birthDate: patient.birthDate === null ? '' : toTypedDate(patient.birthDate),
    address: patient.address ?? '',
    notes: patient.notes ?? '',
  }
}

/**
 * Maps to the snake_case body the serializer reads. Text fields are
 * `CharField(blank=True)` on the server, so "nothing" is "" there; the FK and
 * the date are nullable.
 */
export function toPatientPayload(input: PatientFormInput): Record<string, string | null> {
  return {
    full_name: input.fullName,
    phone_number: input.phoneNumber,
    primary_doctor: input.doctorId === '' ? null : input.doctorId,
    gender: input.gender,
    birth_date: parseTypedDate(input.birthDate),
    address: input.address,
    notes: input.notes,
  }
}

const SERVER_FIELD_NAMES: Record<string, keyof PatientFormInput> = {
  full_name: 'fullName',
  phone_number: 'phoneNumber',
  primary_doctor: 'doctorId',
  gender: 'gender',
  birth_date: 'birthDate',
  address: 'address',
  notes: 'notes',
}

/**
 * The inverse of `toPatientPayload`, for putting a server error back on the
 * input that caused it (§10).
 *
 * Anything unrecognised becomes `root`, so a rejection naming a field this form
 * does not render is still shown rather than silently dropped.
 */
export function patientFormFieldOf(serverField: string): keyof PatientFormInput | 'root' {
  return SERVER_FIELD_NAMES[serverField] ?? 'root'
}
