import * as v from 'valibot'
import { optionalPasswordSchema, passwordSchema, usernameSchema } from '@/shared/lib/credentials'
import type { Administrator } from './types'

/**
 * The writable shape of an admin — what `AdminCreateUpdateSerializer` accepts
 * on create. `role` and `clinic` are absent because the server sets them.
 */

/** The national format, matching what `PhoneInput` emits. */
const UZ_PHONE = /^\+998\d{9}$/

export const administratorFormSchema = v.object({
  username: usernameSchema,
  password: passwordSchema,
  fullName: v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort')),
  phoneNumber: v.pipe(v.string(), v.regex(UZ_PHONE, 'validation.phoneUz')),
  email: v.pipe(
    v.string(),
    v.check(
      (value) => value === '' || v.is(v.pipe(v.string(), v.email()), value),
      'validation.email',
    ),
  ),
})

export type AdministratorFormInput = v.InferOutput<typeof administratorFormSchema>

/** The edit shape: an empty password keeps the current one. */
export const administratorEditFormSchema = v.object({
  ...administratorFormSchema.entries,
  password: optionalPasswordSchema,
})

export function toAdministratorForm(administrator: Administrator): AdministratorFormInput {
  return {
    username: administrator.username ?? '',
    // Never readable back from the server; empty means "keep the current one".
    password: '',
    fullName: administrator.fullName,
    phoneNumber: administrator.phoneNumber ?? '',
    email: administrator.email ?? '',
  }
}

/** PATCH body: no role (it never changes) and no password unless a new one was typed. */
export function toAdministratorUpdatePayload(
  input: AdministratorFormInput,
): Record<string, string> {
  const payload: Record<string, string> = {
    username: input.username,
    full_name: input.fullName,
    phone_number: input.phoneNumber,
    email: input.email,
  }
  if (input.password !== '') payload['password'] = input.password
  return payload
}

export const emptyAdministratorForm: AdministratorFormInput = {
  username: '',
  password: '',
  fullName: '',
  phoneNumber: '',
  email: '',
}

/** Maps to the snake_case body the serializer reads. Empty means null, not "". */
export function toAdministratorPayload(
  input: AdministratorFormInput,
): Record<string, string | null> {
  return {
    role: 'admin',
    username: input.username,
    password: input.password,
    full_name: input.fullName,
    phone_number: input.phoneNumber,
    email: input.email,
  }
}

const SERVER_FIELD_NAMES: Record<string, keyof AdministratorFormInput> = {
  username: 'username',
  password: 'password',
  full_name: 'fullName',
  phone_number: 'phoneNumber',
  email: 'email',
}

/** The inverse, for putting a server error back on the input that caused it (§10). */
export function administratorFormFieldOf(
  serverField: string,
): keyof AdministratorFormInput | 'root' {
  return SERVER_FIELD_NAMES[serverField] ?? 'root'
}
