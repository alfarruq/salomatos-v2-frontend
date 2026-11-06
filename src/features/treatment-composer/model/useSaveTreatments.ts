import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { treatmentKeys, treatmentSchema } from '@/entities/treatment'
import { httpClient } from '@/shared/api/httpClient'
import { toNewTreatmentPayload } from './formSchema'
import type { ComposerFields, TreatmentRow } from './types'

export interface SaveTreatmentsInput {
  patientId: string
  rows: TreatmentRow[]
  fields: ComposerFields
}

/**
 * One `POST procedures/` per row, in order. Sequential rather than parallel so
 * that a refusal stops the rest: the person sees which rows landed instead of
 * an unknown subset.
 */
async function saveTreatments(input: SaveTreatmentsInput): Promise<void> {
  for (const row of input.rows) {
    const payload = toNewTreatmentPayload(row, input.fields, input.patientId)
    if (payload === null) continue
    const raw = await httpClient<unknown>('v1/procedures/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    v.parse(treatmentSchema, raw)
  }
}

/**
 * ⛔ No optimistic update (§6.5): this writes money and a tooth chart a
 * clinician relies on — showing a save the server then refused would mean
 * acting on a record that was never there.
 */
export function useSaveTreatments(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: saveTreatments,
    retry: false,
    // Settled, not success: a run that failed half-way still wrote its first rows.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: treatmentKeys.scope(clinicId) })
      void queryClient.invalidateQueries({ queryKey: ['clinics', clinicId, 'balances'] })
    },
  })
}
