import * as v from 'valibot'
import { pageSchema } from '@/shared/api/pagination'
import { clinicDayOf, clinicTimeOf } from '@/shared/lib/datetime'
import { APPOINTMENT_STATUSES, type Appointment, type AppointmentStatus } from './types'

const optionalText = v.pipe(
  v.optional(v.nullable(v.string()), null),
  v.transform((value) => (value === null || value === '' ? null : value)),
)

/** A status this client does not know is shown as scheduled rather than refusing the calendar. */
const statusSchema = v.pipe(
  v.optional(v.string(), 'scheduled'),
  v.transform(
    (value): AppointmentStatus =>
      (APPOINTMENT_STATUSES as readonly string[]).includes(value)
        ? (value as AppointmentStatus)
        : 'scheduled',
  ),
)

const instant = v.pipe(v.string(), v.isoTimestamp())

/** `AppointmentSerializer`, validated at runtime (ADR-006). */
export const appointmentSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  clinic_name: v.optional(v.string(), ''),
  patient: v.string(),
  patient_name: v.optional(v.string(), ''),
  doctor: v.string(),
  doctor_name: optionalText,
  chair: v.optional(v.nullable(v.string()), null),
  service: v.optional(v.nullable(v.string()), null),
  start_at: instant,
  end_at: instant,
  status: statusSchema,
  notes: optionalText,
})

export const appointmentPageSchema = pageSchema(appointmentSchema)

export type AppointmentResponse = v.InferOutput<typeof appointmentSchema>

export function toAppointment(response: AppointmentResponse): Appointment {
  const minutes = Math.round(
    (new Date(response.end_at).getTime() - new Date(response.start_at).getTime()) / 60_000,
  )
  return {
    id: response.id,
    clinicName: response.clinic_name,
    patientId: response.patient,
    fullName: response.patient_name,
    phoneNumber: null,
    doctorId: response.doctor,
    doctorName: response.doctor_name,
    chairId: response.chair,
    serviceId: response.service,
    treatmentTypeName: null,
    startAt: response.start_at,
    endAt: response.end_at,
    date: clinicDayOf(response.start_at),
    time: clinicTimeOf(response.start_at),
    durationMinutes: minutes,
    notes: response.notes,
    status: response.status,
  }
}
