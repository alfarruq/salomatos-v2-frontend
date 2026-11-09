import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type AppointmentId, appointmentKeys } from '@/entities/appointment'
import { httpClient } from '@/shared/api/httpClient'

/** A booking is never deleted: cancelled visits stay countable next to no-shows. */
async function cancelAppointment(appointmentId: AppointmentId): Promise<void> {
  await httpClient<unknown>(`v1/appointments/${appointmentId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  })
}

/** ⛔ No optimistic update (§6.5): a refused cancel should not change the card first. */
export function useCancelAppointment(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cancelAppointment,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.scope(clinicId) })
    },
  })
}
