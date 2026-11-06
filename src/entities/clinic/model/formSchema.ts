import * as v from 'valibot'
import { toWorkingHoursPayload } from './schema'
import { type Clinic, WEEKDAYS, type WorkingHours } from './types'

/**
 * The writable shape of a branch profile — what `ClinicSerializer` accepts on
 * `PATCH clinic/`. The branch itself comes from `X-Clinic-Id`, never the body.
 */

/** The national format, matching what `PhoneInput` emits. */
const UZ_PHONE = /^\+998\d{9}$/

const dayScheduleFormSchema = v.object({
  isOpen: v.boolean(),
  /** `HH:mm` from a native `<input type="time">`; format is the browser's job. */
  open: v.string(),
  close: v.string(),
})

const hoursSchema = v.object(
  Object.fromEntries(WEEKDAYS.map((day) => [day, dayScheduleFormSchema])) as Record<
    (typeof WEEKDAYS)[number],
    typeof dayScheduleFormSchema
  >,
)

export const clinicFormSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort')),
  phoneNumber: v.pipe(v.string(), v.regex(UZ_PHONE, 'validation.phoneUz')),
  address: v.pipe(v.string(), v.trim(), v.minLength(2, 'validation.tooShort')),
  hours: hoursSchema,
})

export type ClinicFormInput = v.InferOutput<typeof clinicFormSchema>

/** 09:00–18:00, closed on Sunday — a plausible default, not a server one. */
export const emptyClinicForm: ClinicFormInput = {
  name: '',
  phoneNumber: '',
  address: '',
  hours: Object.fromEntries(
    WEEKDAYS.map((day) => [day, { isOpen: day !== 'sun', open: '09:00', close: '18:00' }]),
  ) as ClinicFormInput['hours'],
}

/** Fills the form from the branch's current profile, for editing. */
export function toClinicForm(clinic: Clinic): ClinicFormInput {
  const hours = Object.fromEntries(
    WEEKDAYS.map((day) => {
      const schedule = clinic.workingHours[day]
      const fallback = emptyClinicForm.hours[day]
      // A day missing from the stored hours keeps the default; an explicit null is closed.
      if (schedule === undefined) return [day, fallback]
      return [
        day,
        schedule === null
          ? { ...fallback, isOpen: false }
          : { isOpen: true, open: schedule.open, close: schedule.close },
      ]
    }),
  ) as ClinicFormInput['hours']
  return { name: clinic.name, phoneNumber: clinic.phoneNumber, address: clinic.address, hours }
}

export function toClinicPayload(input: ClinicFormInput): Record<string, unknown> {
  const hours: WorkingHours = {}
  for (const day of WEEKDAYS) {
    const entry = input.hours[day]
    hours[day] = entry.isOpen ? { open: entry.open, close: entry.close } : null
  }

  return {
    name: input.name,
    phone_number: input.phoneNumber,
    address: input.address,
    working_hours: toWorkingHoursPayload(hours),
  }
}

const SERVER_FIELD_NAMES: Record<string, keyof ClinicFormInput> = {
  name: 'name',
  phone_number: 'phoneNumber',
  address: 'address',
}

/** The inverse, for putting a server error back on the input that caused it (§10). */
export function clinicFormFieldOf(serverField: string): keyof ClinicFormInput | 'root' {
  return SERVER_FIELD_NAMES[serverField] ?? 'root'
}
