import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recipeKeys } from '@/entities/recipe'
import { httpClient } from '@/shared/api/httpClient'

async function deleteRecipe(recipeId: string): Promise<void> {
  await httpClient<void>(`v1/prescriptions/${recipeId}/`, { method: 'DELETE' })
}

/** ⛔ No optimistic update (§6.5): a prescription is a medical record. */
export function useDeleteRecipe(clinicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteRecipe,
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recipeKeys.scope(clinicId) })
    },
  })
}
