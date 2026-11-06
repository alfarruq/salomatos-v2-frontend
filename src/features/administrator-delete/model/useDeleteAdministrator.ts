import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type AdministratorId, administratorKeys } from '@/entities/administrator'
import { httpClient } from '@/shared/api/httpClient'

async function deleteAdministrator(administratorId: AdministratorId): Promise<void> {
  await httpClient<void>(`v1/staff/${administratorId}/`, { method: 'DELETE' })
}

/** ⛔ No optimistic update (§6.5): a refused delete should not vanish the record first. */
export function useDeleteAdministrator(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteAdministrator,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: administratorKeys.scope(clinicId) })
    },
  })
}
