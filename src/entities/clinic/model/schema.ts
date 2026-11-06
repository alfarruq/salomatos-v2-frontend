import * as v from 'valibot'
import type { Clinic } from './types'
import { type DaySchedule, WEEKDAYS, type Weekday, type WorkingHours } from './types'

/**
 * The wire contract for `/clinic/` (ADR-006).
 *
 * ⚠️ **No `id` field, on the list or on the create response.** Both
 * `ClinicListSerializer` and `create_clinic`'s response use the same
 * serializer, and neither declares one. `PATCH /clinic/<id>/` exists on the
 * server but this client has no id to put in it — editing an existing clinic
 * is not implemented for exactly that reason, not an oversight. See the
 * comment on `fetchClinic`.
 */

const daySchedule = v.object({
  open: v.string(),
  close: v.string(),
})

/**
 * Reads whatever is in the JSON blob without trusting its shape. Any key that
 * is not a known weekday is ignored; any value that is not `{open, close}` (or
 * null) is treated as that day being unset, rather than thrown at.
 */
function toWorkingHours(raw: unknown): WorkingHours {
  if (typeof raw !== 'object' || raw === null) return {}

  const result: WorkingHours = {}
  for (const day of WEEKDAYS) {
    const value = (raw as Record<string, unknown>)[day]
    if (value === null) {
      result[day] = null
      continue
    }
    const parsed = v.safeParse(daySchedule, value)
    if (parsed.success) result[day] = parsed.output
  }
  return result
}

export const clinicSchema = v.object({
  // The two a profile is not worth showing without.
  id: v.pipe(v.string(), v.uuid()),
  name: v.pipe(v.string(), v.minLength(1)),
  phone_number: v.optional(v.string(), ''),
  address: v.optional(v.string(), ''),
  timezone: v.optional(v.string(), 'Asia/Tashkent'),
  working_hours: v.optional(v.unknown(), null),
})

export type ClinicResponse = v.InferOutput<typeof clinicSchema>

export function toClinic(response: ClinicResponse): Clinic {
  return {
    id: response.id,
    name: response.name,
    phoneNumber: response.phone_number,
    address: response.address,
    timezone: response.timezone,
    workingHours: toWorkingHours(response.working_hours),
  }
}

/** The server's list endpoint returns a plain array — see `fetchClinic`. */

export function toWorkingHoursPayload(hours: WorkingHours): Record<Weekday, DaySchedule | null> {
  const payload = {} as Record<Weekday, DaySchedule | null>
  for (const day of WEEKDAYS) {
    payload[day] = hours[day] ?? null
  }
  return payload
}
