import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { type Treatment, toTreatment, treatmentKeys, treatmentSchema } from '@/entities/treatment'
import { httpClient } from '@/shared/api/httpClient'

async function completeTreatment(treatmentId: string): Promise<Treatment> {
  const raw = await httpClient<unknown>(`v1/procedures/${treatmentId}/complete/`, {
    method: 'POST',
  })
  return toTreatment(v.parse(treatmentSchema, raw))
}

/**
 * No optimistic update: the tooth chart turns green from this, and a doctor
 * must not see work as finished that the server refused to close.
 */
export function useCompleteTreatment(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: completeTreatment,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentKeys.scope(clinicId) })
    },
  })
}
