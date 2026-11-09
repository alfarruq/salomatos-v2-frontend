import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type MedicalHistory,
  type MedicalHistoryInput,
  medicalHistorySchema,
  type PatientId,
  patientKeys,
  toMedicalHistory,
  toMedicalHistoryPayload,
} from '@/entities/patient'
import { httpClient } from '@/shared/api/httpClient'

async function updateMedicalHistory({
  patientId,
  input,
}: {
  patientId: PatientId
  input: MedicalHistoryInput
}): Promise<MedicalHistory> {
  const raw = await httpClient<unknown>(`v1/patients/${patientId}/medical-history/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toMedicalHistoryPayload(input)),
  })
  return toMedicalHistory(v.parse(medicalHistorySchema, raw))
}

/** No optimistic update: an allergy shown before the server stored it is a clinical risk. */
export function useUpdateMedicalHistory(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateMedicalHistory,
    retry: false,
    onSuccess: (history, { patientId }) => {
      queryClient.setQueryData(patientKeys.medicalHistory(clinicId, patientId), history)
    },
  })
}
