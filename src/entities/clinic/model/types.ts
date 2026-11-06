/**
 * The clinic's own business profile — name, contact details, working hours.
 *
 * Distinct from the clinic *account* (`entities/session`'s `Session`, which is
 * a `User` row used for login and as the tenant every query is scoped by).
 * `Clinic` is a separate model the account administers, referenced by
 * `Clinic.admin`.
 *
 * ⚠️ No `id` on the wire. Neither `ClinicListSerializer` nor the create
 * response includes one — see `entities/clinic/api/queries.ts` for what that
 * blocks.
 */
export interface Clinic {
  id: string
  name: string
  phoneNumber: string
  address: string
  timezone: string
  workingHours: WorkingHours
}

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export interface DaySchedule {
  /** `HH:mm`, 24-hour, the clinic's own wall clock — not an instant (§12.4 does not apply). */
  open: string
  close: string
}

/**
 * A day absent from the map, or mapped to `null`, both mean closed.
 *
 * `working_hours` is a bare `JSONField` on the server with no declared shape —
 * this object is this client's own invention, chosen because a JSON blob has
 * to mean something on this end regardless. Any differently-shaped value
 * already stored is read as "nothing set" rather than guessed at.
 */
export type WorkingHours = Partial<Record<Weekday, DaySchedule | null>>
