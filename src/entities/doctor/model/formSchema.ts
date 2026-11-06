import * as v from 'valibot'
import { optionalPasswordSchema, passwordSchema, usernameSchema } from '@/shared/lib/credentials'
import type { Doctor } from './types'

/**
 * The writable shape of a doctor — what `StaffSerializer` accepts with `role='doctor'`.
 *
 * Lives in the entity for the same reason the patient one does: `doctor-create`
 * and `doctor-edit` are two slices in the same layer and §4 forbids one from
 * importing the other, so the definition of what a doctor *is* stays here and
 * each feature owns only its mutation.
 *
 * `clinic` is absent because the server takes it from `X-Clinic-Id` and the
 * caller's membership: a client that could name the clinic could name someone
 * else's. `role` is fixed by `toDoctorPayload`.
 */

/** The national format, matching what `PhoneInput` emits. */
const UZ_PHONE = /^\+998\d{9}$/

export const doctorFormSchema = v.object({
  username: usernameSchema,
  /*
   * Optional here because this is the edit shape: empty keeps the current
   * password (`StaffSerializer.update` only sets one it is given). `doctorCreateFormSchema` makes it required.
   */
  password: optionalPasswordSchema,
  fullName: v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort')),
  phoneNumber: v.pipe(v.string(), v.regex(UZ_PHONE, 'validation.phoneUz')),
  /*
   * Optional, but a wrong address is worse than none: it is where the clinic
   * would send anything that matters. Empty passes; anything else must parse.
   */
  email: v.pipe(
    v.string(),
    v.check(
      (value) => value === '' || v.is(v.pipe(v.string(), v.email()), value),
      'validation.email',
    ),
  ),
  /** A specialty id (`entities/doctor-type`), `''` for unassigned. */
  doctorTypeId: v.string(),
})

/** A new doctor cannot sign in without a password, so the server requires one on create. */
export const doctorCreateFormSchema = v.object({
  ...doctorFormSchema.entries,
  password: passwordSchema,
})

export type DoctorFormInput = v.InferOutput<typeof doctorFormSchema>

export const emptyDoctorForm: DoctorFormInput = {
  username: '',
  password: '',
  fullName: '',
  phoneNumber: '',
  email: '',
  doctorTypeId: '',
}

export function toDoctorForm(doctor: Doctor): DoctorFormInput {
  return {
    username: doctor.username ?? '',
    // Never readable back from the server; empty means "keep the current one".
    password: '',
    fullName: doctor.fullName,
    phoneNumber: doctor.phoneNumber ?? '',
    email: doctor.email ?? '',
    doctorTypeId: doctor.doctorTypeId ?? '',
  }
}

/** Maps to the snake_case body `StaffSerializer` reads. Blank text is "", a missing FK null. */
export function toDoctorPayload(input: DoctorFormInput): Record<string, string | null> {
  const payload: Record<string, string | null> = {
    role: 'doctor',
    username: input.username,
    full_name: input.fullName,
    phone_number: input.phoneNumber,
    email: input.email,
    specialty: input.doctorTypeId === '' ? null : input.doctorTypeId,
  }
  // Sending "" would not clear it, the server would reject it as blank.
  if (input.password !== '') payload['password'] = input.password
  return payload
}

const SERVER_FIELD_NAMES: Record<string, keyof DoctorFormInput> = {
  username: 'username',
  password: 'password',
  full_name: 'fullName',
  phone_number: 'phoneNumber',
  email: 'email',
  specialty: 'doctorTypeId',
}

/** The inverse, for putting a server error back on the input that caused it (§10). */
export function doctorFormFieldOf(serverField: string): keyof DoctorFormInput | 'root' {
  return SERVER_FIELD_NAMES[serverField] ?? 'root'
}
