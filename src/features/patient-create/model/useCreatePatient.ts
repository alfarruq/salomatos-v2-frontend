import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type PatientFormInput,
  type PatientListItem,
  patientKeys,
  patientSchema,
  toPatientListItem,
  toPatientPayload,
} from '@/entities/patient'
import { httpClient } from '@/shared/api/httpClient'

async function createPatient(input: PatientFormInput): Promise<PatientListItem> {
  const raw = await httpClient<unknown>('v1/patients/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPatientPayload(input)),
  })

  // `PatientService.create_patient` answers with the *list* serializer, not the
  // detail one — so the new row can go straight into a list without a refetch.
  return toPatientListItem(v.parse(patientSchema, raw))
}

/**
 * ⛔ No optimistic update, on purpose.
 *
 * §6.5 allows optimistic updates only for reversible actions. The server
 * assigns the id, and `unique_phone_per_clinic` means a create can legitimately
 * be refused after the row is already on screen. Showing a patient who does not
 * exist, in a medical record system, is worse than a second of waiting.
 */
export function useCreatePatient(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createPatient,

    onSuccess: () => {
      /*
       * The whole tenant scope, not one list: the new patient's position
       * depends on the active search, status filter and page, none of which
       * this hook knows. Invalidating the scope re-asks for whichever lists
       * are actually mounted and leaves the rest to be refetched when used.
       */
      void queryClient.invalidateQueries({ queryKey: patientKeys.scope(clinicId) })
    },
  })
}
