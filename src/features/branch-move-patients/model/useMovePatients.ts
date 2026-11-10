import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { branchKeys } from '@/entities/branch'
import { patientKeys } from '@/entities/patient'
import { httpClient } from '@/shared/api/httpClient'

export interface MovePatientsInput {
  targetBranchId: string
  patientIds: readonly string[]
  doctorId: string
}

/** Patients of the current branch (`X-Clinic-Id`) go to the target; money stays behind. */
async function movePatients({ targetBranchId, patientIds, doctorId }: MovePatientsInput) {
  const raw = await httpClient<unknown>(`v1/branches/${targetBranchId}/move-patients/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patients: patientIds, doctor: doctorId }),
  })
  return v.parse(v.object({ moved: v.number() }), raw)
}

/** ⛔ No optimistic update (§6.5): the server refuses the whole batch if one patient cannot move. */
export function useMovePatients(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: movePatients,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.scope(clinicId) })
      void queryClient.invalidateQueries({ queryKey: branchKeys.scope(clinicId) })
    },
  })
}
