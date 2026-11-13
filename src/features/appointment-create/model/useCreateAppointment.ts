import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Appointment,
  type AppointmentFormInput,
  appointmentKeys,
  appointmentSchema,
  toAppointment,
  toAppointmentPayload,
} from '@/entities/appointment'
import { patientKeys } from '@/entities/patient'
import { httpClient } from '@/shared/api/httpClient'

async function createAppointment(input: AppointmentFormInput): Promise<Appointment> {
  const raw = await httpClient<unknown>('v1/appointments/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toAppointmentPayload(input)),
  })

  return toAppointment(v.parse(appointmentSchema, raw))
}

/**
 * ⛔ No optimistic update (§6.5): the server assigns the id, and a booking
 * shown before the server confirms it could double-book the slot.
 */
export function useCreateAppointment(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAppointment,
    onSuccess: (_appointment, input) => {
      // The whole scope, not just the current view: a new appointment can
      // land on a date the day/week filter currently open isn't showing.
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.scope(clinicId) })
      // Someone new was stored as a lead; the booking search must find them next time.
      if (input.patientId === '') {
        void queryClient.invalidateQueries({ queryKey: patientKeys.scope(clinicId) })
      }
    },
  })
}
