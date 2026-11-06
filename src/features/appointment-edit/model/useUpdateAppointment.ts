import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type Appointment,
  type AppointmentFormInput,
  type AppointmentId,
  appointmentKeys,
  appointmentSchema,
  toAppointment,
  toAppointmentPayload,
} from '@/entities/appointment'
import { httpClient } from '@/shared/api/httpClient'

async function updateAppointment({
  appointmentId,
  input,
}: {
  appointmentId: AppointmentId
  input: AppointmentFormInput
}): Promise<Appointment> {
  const payload = toAppointmentPayload(input)

  const raw = await httpClient<unknown>(`v1/appointments/${appointmentId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return toAppointment(v.parse(appointmentSchema, raw))
}

/** ⛔ No optimistic update (§6.5): a rejected edit must not show the wrong slot as saved. */
export function useUpdateAppointment(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateAppointment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.scope(clinicId) })
    },
  })
}
