import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type PatientId, patientKeys } from '@/entities/patient'
import { httpClient } from '@/shared/api/httpClient'

/** Patients are never deleted: their clinical and payment history must survive. */
async function archivePatient(patientId: PatientId): Promise<void> {
  await httpClient<unknown>(`v1/patients/${patientId}/archive/`, { method: 'POST' })
}

/** ⛔ No optimistic update (§6.5): a refused archive should not vanish the card first. */
export function useArchivePatient(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: archivePatient,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.scope(clinicId) })
    },
  })
}
