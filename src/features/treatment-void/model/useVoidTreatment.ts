import { useMutation, useQueryClient } from '@tanstack/react-query'
import { treatmentKeys } from '@/entities/treatment'
import { httpClient } from '@/shared/api/httpClient'

export interface VoidTreatmentInput {
  treatmentId: string
  reason: string
}

/** Money is append-only: a mistaken procedure is voided with a reason, never deleted. */
async function voidTreatment({ treatmentId, reason }: VoidTreatmentInput): Promise<void> {
  await httpClient<unknown>(`v1/procedures/${treatmentId}/void/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
}

/** ⛔ No optimistic update (§6.5): this changes what the patient owes. */
export function useVoidTreatment(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: voidTreatment,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentKeys.scope(clinicId) })
      // The patient's balance is derived from procedures on the server.
      void queryClient.invalidateQueries({ queryKey: ['clinics', clinicId, 'balances'] })
    },
  })
}
