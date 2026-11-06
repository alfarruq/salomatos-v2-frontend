import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type TreatmentTypeId, treatmentTypeKeys } from '@/entities/treatment-type'
import { httpClient } from '@/shared/api/httpClient'

async function deleteTreatmentType(treatmentTypeId: TreatmentTypeId): Promise<void> {
  await httpClient<void>(`v1/services/${treatmentTypeId}/`, { method: 'DELETE' })
}

/** ⛔ No optimistic update (§6.5): a refused delete should not vanish the row first. */
export function useDeleteTreatmentType(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTreatmentType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentTypeKeys.scope(clinicId) })
    },
  })
}
