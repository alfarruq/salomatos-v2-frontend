import * as v from 'valibot'
import type { TreatmentType } from './types'

/**
 * The writable shape of a service — what `ServiceSerializer` accepts. The
 * clinic is set by the server from `X-Clinic-Id`.
 *
 * In the entity rather than a feature, so create and edit share one definition
 * without importing each other (§4).
 */

/** Digits only. Money is entered as whole so'm — no separators, no decimals. */
const DIGITS = /^\d+$/

export const treatmentTypeFormSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort')),
  /*
   * Required: a procedure copies the service's price onto its line when it is
   * recorded, so a service without one would bill nothing. Digits only, which
   * is what stops "1 200 000" being sent as a broken number.
   */
  price: v.pipe(
    v.string(),
    v.trim(),
    v.check((value) => DIGITS.test(value), 'validation.invalid'),
  ),
  /** A specialty id (`entities/doctor-type`), `''` for unassigned. */
  doctorTypeId: v.string(),
})

export type TreatmentTypeFormInput = v.InferOutput<typeof treatmentTypeFormSchema>

export const emptyTreatmentTypeForm: TreatmentTypeFormInput = {
  name: '',
  price: '',
  doctorTypeId: '',
}

export function toTreatmentTypeForm(service: TreatmentType): TreatmentTypeFormInput {
  return {
    name: service.name,
    price: String(service.price),
    doctorTypeId: service.doctorTypeId ?? '',
  }
}

export function toTreatmentTypePayload(
  input: TreatmentTypeFormInput,
): Record<string, string | null> {
  return {
    name: input.name,
    // A decimal string, as DRF's DecimalField reads and writes it.
    price: input.price,
    specialty: input.doctorTypeId === '' ? null : input.doctorTypeId,
  }
}

const SERVER_FIELD_NAMES: Record<string, keyof TreatmentTypeFormInput> = {
  name: 'name',
  price: 'price',
  specialty: 'doctorTypeId',
}

/** The inverse, for putting a server error back on the input that caused it (§10). */
export function treatmentTypeFormFieldOf(
  serverField: string,
): keyof TreatmentTypeFormInput | 'root' {
  return SERVER_FIELD_NAMES[serverField] ?? 'root'
}
