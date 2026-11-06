import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type PatientFormInput,
  type PatientId,
  type PatientListItem,
  patientKeys,
  patientSchema,
  toPatientListItem,
  toPatientPayload,
} from '@/entities/patient'
import { httpClient } from '@/shared/api/httpClient'

async function updatePatient({
  patientId,
  input,
}: {
  patientId: PatientId
  input: PatientFormInput
}): Promise<PatientListItem> {
  const payload = toPatientPayload(input)

  const raw = await httpClient<unknown>(`v1/patients/${patientId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return toPatientListItem(v.parse(patientSchema, raw))
}

/**
 * ⛔ No optimistic update. §6.5 permits them only for reversible actions, and a
 * patient's name and phone number are the fields staff use to identify the
 * right person — showing an edit that the server then refused would mean
 * looking at a record that says something nobody saved.
 */
export function useUpdatePatient(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updatePatient,

    onSuccess: (_patient, { patientId }) => {
      // The card, and every list the row could appear in.
      void queryClient.invalidateQueries({ queryKey: patientKeys.detail(clinicId, patientId) })
      void queryClient.invalidateQueries({ queryKey: patientKeys.scope(clinicId) })
    },
  })
}
