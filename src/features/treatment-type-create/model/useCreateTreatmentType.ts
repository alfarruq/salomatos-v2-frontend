import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type TreatmentType,
  type TreatmentTypeFormInput,
  toTreatmentType,
  toTreatmentTypePayload,
  treatmentTypeKeys,
  treatmentTypeSchema,
} from '@/entities/treatment-type'
import { httpClient } from '@/shared/api/httpClient'

async function createTreatmentType(input: TreatmentTypeFormInput): Promise<TreatmentType> {
  const raw = await httpClient<unknown>('v1/services/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toTreatmentTypePayload(input)),
  })

  // The server sets `clinic` itself and answers with the list serializer.
  return toTreatmentType(v.parse(treatmentTypeSchema, raw))
}

/** ⛔ No optimistic update (§6.5): the server assigns the id. */
export function useCreateTreatmentType(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTreatmentType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentTypeKeys.scope(clinicId) })
    },
  })
}
