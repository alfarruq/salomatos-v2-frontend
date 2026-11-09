import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type AppointmentId, type AppointmentStatus, appointmentKeys } from '@/entities/appointment'
import { httpClient } from '@/shared/api/httpClient'

async function setAppointmentStatus({
  appointmentId,
  status,
}: {
  appointmentId: AppointmentId
  status: AppointmentStatus
}): Promise<void> {
  await httpClient<unknown>(`v1/appointments/${appointmentId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

/** No optimistic update: the queue's counters and "next patient" follow the server's answer. */
export function useSetAppointmentStatus(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: setAppointmentStatus,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: appointmentKeys.scope(clinicId) })
    },
  })
}
