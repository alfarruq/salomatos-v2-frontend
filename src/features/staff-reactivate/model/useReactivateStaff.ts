import { useMutation, useQueryClient } from '@tanstack/react-query'
import { administratorKeys } from '@/entities/administrator'
import { doctorKeys } from '@/entities/doctor'
import { httpClient } from '@/shared/api/httpClient'

async function reactivateStaff(staffId: string): Promise<void> {
  await httpClient<unknown>(`v1/staff/${staffId}/reactivate/`, { method: 'POST' })
}

/** Brings back a deactivated doctor or admin; both lists and every doctor picker refresh. */
export function useReactivateStaff(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reactivateStaff,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: doctorKeys.scope(clinicId) })
      void queryClient.invalidateQueries({ queryKey: administratorKeys.scope(clinicId) })
    },
  })
}
