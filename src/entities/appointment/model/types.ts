import type { CalendarDate } from '@/shared/lib/calendarDate'

/** UUID. */
export type AppointmentId = string

/** `Appointment.Status` on the backend, in the order a visit moves through them. */
export const APPOINTMENT_STATUSES = [
  'scheduled',
  'confirmed',
  'arrived',
  'in_chair',
  'completed',
  'no_show',
  'cancelled',
] as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

/**
 * A booked visit (`AppointmentSerializer`).
 *
 * The server stores `start_at`/`end_at` as UTC instants. `date` and `time` are
 * the same start on the clinic's wall clock (§14), derived once at the
 * boundary so the calendar never converts zones itself.
 */
export interface Appointment {
  id: AppointmentId
  clinicName: string
  patientId: string
  /** The patient's name, as the server sends it beside the id. */
  fullName: string
  /** Not part of the appointment response; kept for screens that show one when they have it. */
  phoneNumber: string | null
  doctorId: string
  doctorName: string | null
  chairId: string | null
  serviceId: string | null
  /** Filled in by screens that hold the price list; the response carries only the id. */
  treatmentTypeName: string | null
  startAt: string
  endAt: string
  date: CalendarDate
  /** `HH:mm`, clinic time. */
  time: string
  durationMinutes: number
  notes: string | null
  status: AppointmentStatus
}

/** Which slice of the calendar to load. `all` loads every appointment, page by page. */
export type AppointmentView = 'day' | 'week' | 'all'

export interface AppointmentFilters {
  view: AppointmentView
  /** The day being viewed, or a day inside the viewed week; unused for `all`. */
  date: CalendarDate
  /** A doctor's staff id; absent means every doctor. */
  doctorId?: string
  /** A patient id; absent means every patient. */
  patientId?: string
}
