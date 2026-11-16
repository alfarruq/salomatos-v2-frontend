import { useMutation, useQueryClient } from '@tanstack/react-query'
import { treatmentKeys } from '@/entities/treatment'
import { httpClient } from '@/shared/api/httpClient'

export interface UpdateTreatmentInput {
  treatmentId: string
  notes: string
}

/** The server accepts only the note: prices and dates are fixed once recorded (void and re-enter). */
async function updateTreatment({ treatmentId, notes }: UpdateTreatmentInput): Promise<void> {
  await httpClient<unknown>(`v1/procedures/${treatmentId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
}

export function useUpdateTreatment(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTreatment,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentKeys.scope(clinicId) })
    },
  })
}
