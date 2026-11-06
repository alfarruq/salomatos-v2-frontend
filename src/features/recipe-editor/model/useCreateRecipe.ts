import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as v from 'valibot'
import { recipeKeys, recipeSchema } from '@/entities/recipe'
import { httpClient } from '@/shared/api/httpClient'
import type { RecipePayload } from './payload'

async function createRecipe(payload: RecipePayload): Promise<void> {
  const raw = await httpClient<unknown>('v1/prescriptions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  v.parse(recipeSchema, raw)
}

/** ⛔ No optimistic update (§6.5): a prescription is a medical record. */
export function useCreateRecipe(clinicId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createRecipe,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.scope(clinicId) })
    },
  })
}
