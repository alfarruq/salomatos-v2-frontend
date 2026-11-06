import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import {
  type TreatmentType,
  type TreatmentTypeFormInput,
  type TreatmentTypeId,
  toTreatmentType,
  toTreatmentTypePayload,
  treatmentTypeKeys,
  treatmentTypeSchema,
} from '@/entities/treatment-type'
import { httpClient } from '@/shared/api/httpClient'

async function updateTreatmentType({
  treatmentTypeId,
  input,
}: {
  treatmentTypeId: TreatmentTypeId
  input: TreatmentTypeFormInput
}): Promise<TreatmentType> {
  const payload = toTreatmentTypePayload(input)

  const raw = await httpClient<unknown>(`v1/services/${treatmentTypeId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return toTreatmentType(v.parse(treatmentTypeSchema, raw))
}

/**
 * ⛔ No optimistic update, and here it matters more than usual: a price is
 * what gets quoted to a patient. Showing one the server refused would mean
 * quoting a number nobody saved.
 */
export function useUpdateTreatmentType(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateTreatmentType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentTypeKeys.scope(clinicId) })
    },
  })
}
