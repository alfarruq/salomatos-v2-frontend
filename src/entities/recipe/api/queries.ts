import { queryOptions } from '@tanstack/react-query'
import { httpBlob, httpClient } from '@/shared/api/httpClient'
import { fetchAllPages } from '@/shared/api/pagination'
import { cachePolicy } from '@/shared/config/cache'
import { recipeSchema, toRecipe } from '../model/schema'
import type { Recipe } from '../model/types'

/** §6.2 — the tenant scope is inside every key, without exception. */
export const recipeKeys = {
  scope: (clinicId: string) => ['clinics', clinicId, 'recipes'] as const,

  list: (clinicId: string, patientId: string) =>
    [...recipeKeys.scope(clinicId), 'list', patientId] as const,
}

export async function fetchRecipes(patientId: string, signal?: AbortSignal): Promise<Recipe[]> {
  const init = signal === undefined ? {} : { signal }
  const rows = await fetchAllPages(
    `v1/prescriptions/?patient=${patientId}&page_size=100`,
    recipeSchema,
    (path) => httpClient<unknown>(path, init),
  )
  return rows.map(toRecipe)
}

/** The printable PDF. Held in memory only; the file name on the server carries the id, never a name. */
export function fetchRecipePdf(recipeId: string, signal?: AbortSignal): Promise<Blob> {
  return httpBlob(`v1/prescriptions/${recipeId}/pdf/`, signal === undefined ? {} : { signal })
}

export const recipeQueries = {
  list: (clinicId: string, patientId: string) =>
    queryOptions({
      queryKey: recipeKeys.list(clinicId, patientId),
      queryFn: ({ signal }) => fetchRecipes(patientId, signal),
      ...cachePolicy.standard,
    }),
}
