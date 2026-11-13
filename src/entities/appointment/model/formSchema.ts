import * as v from 'valibot'
import { parseCalendarDate } from '@/shared/lib/calendarDate'
import { clinicInstantOf } from '@/shared/lib/datetime'
import { APPOINTMENT_STATUSES, type Appointment } from './types'

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

/**
 * The writable shape of an appointment — what `AppointmentSerializer` accepts.
 *
 * A visit is booked either for a picked patient (`patientId`) or for someone
 * new: then `fullName` is their name and `phoneNumber` their phone, and the
 * server stores them as a lead, outside the patient list, until the first
 * procedure. Otherwise `fullName` is only the picker's search text.
 */
const UZ_PHONE = /^\+998\d{9}$/

export const appointmentFormSchema = v.pipe(
  v.object({
    fullName: v.string(),
    patientId: v.string(),
    /** Only for someone new; '' when a patient is picked. */
    phoneNumber: v.string(),
    doctorId: v.pipe(v.string(), v.minLength(1, 'validation.required')),
    serviceId: v.string(),
    date: v.pipe(
      v.string(),
      v.minLength(1, 'validation.required'),
      v.check((value) => parseCalendarDate(value) !== null, 'validation.invalid'),
    ),
    time: v.pipe(v.string(), v.regex(TIME, 'validation.invalid')),
    /** Minutes, as the select holds it. */
    durationMinutes: v.pipe(v.string(), v.regex(/^\d+$/, 'validation.invalid')),
    notes: v.string(),
    status: v.picklist(APPOINTMENT_STATUSES),
  }),
  v.forward(
    v.partialCheck(
      [['patientId'], ['phoneNumber']],
      (input) => input.patientId !== '' || input.phoneNumber !== '',
      'validation.patientRequired',
    ),
    ['patientId'],
  ),
  v.forward(
    v.partialCheck(
      [['patientId'], ['fullName']],
      (input) => input.patientId !== '' || input.fullName.trim().length >= 2,
      'validation.tooShort',
    ),
    ['fullName'],
  ),
  v.forward(
    v.partialCheck(
      [['patientId'], ['phoneNumber']],
      (input) =>
        input.patientId !== '' || input.phoneNumber === '' || UZ_PHONE.test(input.phoneNumber),
      'validation.phoneUz',
    ),
    ['phoneNumber'],
  ),
)

export type AppointmentFormInput = v.InferOutput<typeof appointmentFormSchema>

export const emptyAppointmentForm: AppointmentFormInput = {
  fullName: '',
  patientId: '',
  phoneNumber: '',
  doctorId: '',
  serviceId: '',
  date: '',
  time: '',
  durationMinutes: '30',
  notes: '',
  status: 'scheduled',
}

export function toAppointmentForm(appointment: Appointment): AppointmentFormInput {
  return {
    fullName: appointment.fullName,
    patientId: appointment.patientId,
    phoneNumber: '',
    doctorId: appointment.doctorId,
    serviceId: appointment.serviceId ?? '',
    date: appointment.date,
    time: appointment.time,
    durationMinutes: String(appointment.durationMinutes),
    notes: appointment.notes ?? '',
    status: appointment.status,
  }
}

/**
 * Maps to the body the serializer reads. The wall-clock day and hour become
 * UTC instants here, once, on the clinic's clock (§14). `end_at` is always
 * sent: on an edit the server keeps the stored end, so moving the start alone
 * could put the end before it.
 */
export interface AppointmentPayload {
  patient?: string
  new_patient?: { full_name: string; phone_number: string }
  doctor: string
  service: string | null
  start_at: string
  end_at: string
  notes: string
  status: string
}

export function toAppointmentPayload(input: AppointmentFormInput): AppointmentPayload {
  const startAt = clinicInstantOf(input.date, input.time)
  const endAt = new Date(
    new Date(startAt).getTime() + Number(input.durationMinutes) * 60_000,
  ).toISOString()
  return {
    ...(input.patientId === ''
      ? { new_patient: { full_name: input.fullName.trim(), phone_number: input.phoneNumber } }
      : { patient: input.patientId }),
    doctor: input.doctorId,
    service: input.serviceId === '' ? null : input.serviceId,
    start_at: startAt,
    end_at: endAt,
    notes: input.notes,
    status: input.status,
  }
}

const SERVER_FIELD_NAMES: Record<string, keyof AppointmentFormInput> = {
  patient: 'patientId',
  'new_patient.full_name': 'fullName',
  'new_patient.phone_number': 'phoneNumber',
  doctor: 'doctorId',
  service: 'serviceId',
  start_at: 'time',
  end_at: 'durationMinutes',
  notes: 'notes',
  status: 'status',
}

/** The inverse, for putting a server error back on the input that caused it (§10). */
export function appointmentFormFieldOf(serverField: string): keyof AppointmentFormInput | 'root' {
  return SERVER_FIELD_NAMES[serverField] ?? 'root'
}
