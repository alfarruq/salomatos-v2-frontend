import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { recipeKeys, recipeSchema } from '@/entities/recipe'
import { httpClient } from '@/shared/api/httpClient'
import type { RecipeUpdatePayload } from './payload'

async function updateRecipe({
  recipeId,
  payload,
}: {
  recipeId: string
  payload: RecipeUpdatePayload
}): Promise<void> {
  const raw = await httpClient<unknown>(`v1/prescriptions/${recipeId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  v.parse(recipeSchema, raw)
}

/** ⛔ No optimistic update (§6.5): a prescription is a medical record. */
export function useUpdateRecipe(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateRecipe,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.scope(clinicId) })
    },
  })
}
