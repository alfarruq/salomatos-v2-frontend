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

async function registerLead({
  patientId,
  input,
}: {
  patientId: PatientId
  input: PatientFormInput
}): Promise<PatientListItem> {
  const raw = await httpClient<unknown>(`v1/patients/${patientId}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPatientPayload(input)),
  })
  return toPatientListItem(v.parse(patientSchema, raw))
}

/**
 * Saves the form onto a person who already booked (a lead) and makes them a
 * patient, instead of creating a second row for the same person.
 *
 * Same as `patient-edit`'s register call; duplicated because §4 forbids one
 * feature importing another. No optimistic update, for the reasons in
 * `useCreatePatient`.
 */
export function useRegisterLead(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: registerLead,
    onSuccess: (_patient, { patientId }) => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.detail(clinicId, patientId) })
      void queryClient.invalidateQueries({ queryKey: patientKeys.scope(clinicId) })
    },
  })
}
