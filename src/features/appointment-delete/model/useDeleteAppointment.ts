import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type AppointmentId, appointmentKeys } from '@/entities/appointment'
import { httpClient } from '@/shared/api/httpClient'

async function deleteAppointment(appointmentId: AppointmentId): Promise<void> {
  await httpClient<void>(`v1/appointments/${appointmentId}/`, { method: 'DELETE' })
}

/** ⛔ No optimistic update (§6.5): a refused delete should not vanish the slot first. */
export function useDeleteAppointment(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteAppointment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.scope(clinicId) })
    },
  })
}
